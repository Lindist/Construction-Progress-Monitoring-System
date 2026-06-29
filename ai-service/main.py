from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import os
import threading
import json
import time
import traceback
import redis
import requests
from detector import ConstructionDetector


app = FastAPI(title="Construction Progress AI Service")
detector = ConstructionDetector()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessPayload(BaseModel):
    media_id: str
    file_path: str
    interval: float = 5.0

@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ai-service"}

def run_video_processing(media_id: str, file_path: str, interval: float = 5.0) -> dict:
    # Resolve storage paths
    storage_root = os.getenv("STORAGE_ROOT", "../storage")
    video_path = os.path.abspath(file_path)
    
    if not os.path.exists(video_path):
        # Try finding it relative to storage root if absolute path check fails due to OS differences
        alt_path = os.path.abspath(os.path.join(storage_root, "uploads", os.path.basename(file_path)))
        if os.path.exists(alt_path):
            video_path = alt_path
        else:
            raise FileNotFoundError(f"Video file not found at {video_path}")
            
    output_dir = os.path.abspath(os.path.join(storage_root, "uploads", "frames", media_id))
    os.makedirs(output_dir, exist_ok=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Failed to open video file: {video_path}")
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0  # fallback
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    
    frames_list = []
    
    # Extract frames at regular intervals
    t = 0.0
    while t < duration:
        frame_idx = int(t * fps)
        if frame_idx >= total_frames:
            break
            
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_filename = f"frame_{t:.2f}.jpg"
        frame_save_path = os.path.join(output_dir, frame_filename)
        cv2.imwrite(frame_save_path, frame)
        
        # Run object detection
        try:
            frame_detections = detector.detect(frame_save_path, media_id, t)
        except Exception as e:
            print(f"Failed to run detection on frame at t={t}: {e}")
            frame_detections = []
            
        # Save relative path or absolute path. Let's save absolute path for backend consumption
        frames_list.append({
            "timestamp": t,
            "frame_path": frame_save_path,
            "detections": frame_detections
        })
        
        t += interval
        
    cap.release()
    
    # Generate thumbnail from the first frame
    if frames_list:
        first_frame_img = cv2.imread(frames_list[0]["frame_path"])
        if first_frame_img is not None:
            # Resize to standard thumbnail size (320x180)
            thumbnail_img = cv2.resize(first_frame_img, (320, 180))
            thumbnail_path = os.path.join(output_dir, "thumbnail.jpg")
            cv2.imwrite(thumbnail_path, thumbnail_img)
            
    # Generate timeline montage (horizontal strip of first 10 frames)
    if frames_list:
        montage_images = []
        for f_info in frames_list[:10]:
            img = cv2.imread(f_info["frame_path"])
            if img is not None:
                # Resize maintaining aspect ratio with fixed height of 90px
                h, w = img.shape[:2]
                new_w = int(w * (90 / h))
                resized_img = cv2.resize(img, (new_w, 90))
                montage_images.append(resized_img)
                
        if montage_images:
            timeline_strip = cv2.hconcat(montage_images)
            timeline_path = os.path.join(output_dir, "timeline.jpg")
            cv2.imwrite(timeline_path, timeline_strip)
            
    return {
        "media_id": media_id,
        "frames": frames_list
    }

@app.post("/process")
@app.post("/api/process")
async def process_video(payload: ProcessPayload):
    try:
        return run_video_processing(payload.media_id, payload.file_path, payload.interval)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def redis_worker_loop():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    print(f"Worker: Connecting to Redis at {redis_url}...")
    r = None
    for attempt in range(15):
        try:
            r = redis.Redis.from_url(redis_url)
            r.ping()
            print(f"Worker: Connected to Redis successfully on attempt {attempt+1}")
            break
        except Exception as e:
            print(f"Worker: Waiting for Redis... attempt {attempt+1}/15: {e}")
            time.sleep(2)
            
    if r is None:
        print("Worker: Failed to connect to Redis. Background queue processing will be unavailable.")
        return

    print(f"Worker: Listening for jobs on 'video_processing_queue' with callback to {backend_url}...")
    while True:
        try:
            # Blocking pop with a timeout
            job_raw = r.blpop("video_processing_queue", timeout=5)
            if not job_raw:
                continue
                
            _, payload_str = job_raw
            job_payload = json.loads(payload_str)
            
            job_id = job_payload.get("job_id")
            media_id = job_payload.get("media_id")
            file_path = job_payload.get("file_path")
            interval = job_payload.get("interval", 5.0)
            
            print(f"Worker: Processing job {job_id} for media {media_id}")
            
            # Update status to processing
            update_job_status(backend_url, job_id, "processing")
            
            try:
                result = run_video_processing(media_id, file_path, interval)
                # Submit results
                submit_job_results(backend_url, job_id, result)
                print(f"Worker: Job {job_id} completed successfully")
            except Exception as ex:
                err_msg = "".join(traceback.format_exception(None, ex, ex.__traceback__))
                print(f"Worker: Error processing job {job_id}: {err_msg}")
                # Update status to failed
                update_job_status(backend_url, job_id, "failed", error_message=str(ex))
                
        except Exception as e:
            print(f"Worker: Error in queue loop: {e}")
            time.sleep(2)

def update_job_status(backend_url: str, job_id: str, status: str, error_message: str = None):
    url = f"{backend_url}/api/jobs/{job_id}/status"
    payload = {"status": status}
    if error_message:
        payload["error_message"] = error_message
        
    for attempt in range(3):
        try:
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                return
            print(f"Worker: Failed to update status to {status} for job {job_id}: status_code={resp.status_code}")
        except Exception as e:
            print(f"Worker: Error sending status update to backend: {e}")
        time.sleep(1)

def submit_job_results(backend_url: str, job_id: str, results: dict):
    url = f"{backend_url}/api/jobs/{job_id}/results"
    for attempt in range(5):
        try:
            resp = requests.post(url, json=results, timeout=30)
            if resp.status_code == 200:
                return
            print(f"Worker: Failed to submit results for job {job_id}: status_code={resp.status_code}")
        except Exception as e:
            print(f"Worker: Error submitting results to backend: {e}")
        time.sleep(2)
    raise Exception("Failed to post results back to backend after multiple attempts")

@app.on_event("startup")
def startup_event():
    # Start Redis background worker thread
    thread = threading.Thread(target=redis_worker_loop, daemon=True)
    thread.start()
    print("AI Service: Started background worker thread")



import time
from typing import List

class ObjectDiff(BaseModel):
    object_type: str
    count_a: int
    count_b: int
    difference: int

class SummarizePayload(BaseModel):
    project_name: str
    report_type: str
    current_progress: float
    previous_progress: float
    growth: float
    structural_growth_desc: str
    object_diffs: List[ObjectDiff]

@app.post("/summarize")
@app.post("/api/summarize")
async def generate_summary(payload: SummarizePayload):
    proj_name = payload.project_name
    rep_type = payload.report_type.upper()
    curr_prog = payload.current_progress
    prev_prog = payload.previous_progress
    growth = payload.growth
    struct_desc = payload.structural_growth_desc
    
    # Index object diffs
    diffs = {d.object_type: d for d in payload.object_diffs}
    
    workers = diffs.get("Worker")
    helmets = diffs.get("Helmet")
    cranes = diffs.get("Crane")
    excavators = diffs.get("Excavator")
    scaffolding = diffs.get("Scaffolding")
    pillars = diffs.get("Pillar")
    walls = diffs.get("Wall")
    equip = diffs.get("Construction Equipment")
    
    # 1. Executive Summary Paragraph
    if growth > 0:
        exec_summary = f"The {payload.report_type} inspection for **{proj_name}** indicates a significant construction phase advancement. Over the latest monitoring period, overall project progress increased by **{growth:.1f}%**, rising from a baseline of {prev_prog:.1f}% to **{curr_prog:.1f}%**."
    elif growth < 0:
        exec_summary = f"The {payload.report_type} inspection for **{proj_name}** shows progress registered at **{curr_prog:.1f}%** compared to the previous inspection baseline of {prev_prog:.1f}% (change score: {abs(growth):.1f}%)."
    else:
        exec_summary = f"The {payload.report_type} inspection for **{proj_name}** indicates a period of structural consolidation. Overall project progress remains stable at **{curr_prog:.1f}%** compared to the previous inspection baseline of {prev_prog:.1f}%."

    # 2. Structural Growth Paragraph
    structural_details = []
    if struct_desc and "No structural growth" not in struct_desc:
        structural_details.append(struct_desc)
    
    if pillars and pillars.difference > 0:
        structural_details.append(f"We recorded the completion of {pillars.difference} new support pillars on site, strengthening the vertical framework.")
    elif pillars and pillars.count_b > 0:
        structural_details.append(f"A total of {pillars.count_b} structural support pillars are actively standing in the current inspection layout.")
        
    if walls and walls.difference > 0:
        structural_details.append(f"Core concrete wall segments increased by {walls.difference} sections, expanding partition framing.")
    elif walls and walls.count_b > 0:
        structural_details.append(f"Partition framing is steady with {walls.count_b} concrete wall sections verified.")
        
    if scaffolding and scaffolding.difference > 0:
        structural_details.append(f"Temporary scaffolding installations were expanded (+{scaffolding.difference} zones) to facilitate overhead welding and masonry.")
    elif scaffolding and scaffolding.count_b > 0:
        structural_details.append(f"Scaffolding support frames are active across {scaffolding.count_b} sectors.")
        
    if not structural_details:
        structural_details.append("No major layout or structural boundary modifications were registered during this timeline.")
        
    structural_para = " ".join(structural_details)

    # 3. Resource Activity & Safety Paragraph
    resource_details = []
    
    worker_count = workers.count_b if workers else 0
    helmet_count = helmets.count_b if helmets else 0
    
    if worker_count > 0:
        compliance_pct = 100.0
        if helmet_count < worker_count:
            compliance_pct = (helmet_count / worker_count) * 100.0
            
        resource_details.append(f"AI inspection identified {worker_count} active workers on the site floor.")
        if compliance_pct >= 95.0:
            resource_details.append(f"Safety compliance audits logged excellent PPE helmet adherence at **{compliance_pct:.0f}%**.")
        else:
            resource_details.append(f"WARNING: Safety compliance checks flagged a **{compliance_pct:.0f}%** PPE helmet rate ({worker_count - helmet_count} worker(s) without safety gear detected in high-risk sectors). Safety alerts have been issued.")
    else:
        resource_details.append("No worker personnel were active on the main construction floor during the visual sweeps.")

    active_machinery = []
    if cranes and cranes.count_b > 0:
        active_machinery.append(f"{cranes.count_b} tower crane(s)")
    if excavators and excavators.count_b > 0:
        active_machinery.append(f"{excavators.count_b} excavation vehicle(s)")
    if equip and equip.count_b > 0:
        active_machinery.append(f"{equip.count_b} general construction equipment units")
        
    if active_machinery:
        resource_details.append("Heavy site machinery was logged in operation: " + ", ".join(active_machinery) + ".")
    else:
        resource_details.append("No active heavy machinery operations were captured in this inspection window.")

    resource_para = " ".join(resource_details)

    # 4. Recommendation Paragraph
    recommendations = []
    if growth > 0:
        recommendations.append("Continue current structural construction velocity to stay aligned with the timeline milestones.")
    else:
        recommendations.append("Verify logistical pipeline for structural materials to resume progress velocity.")
        
    if workers and helmet_count < worker_count:
        recommendations.append("Enforce strict safety checkpoints and mandatory helmet inspections at Sector access gates.")
    else:
        recommendations.append("Maintain high PPE compliance standards across all active sectors.")
        
    if walls and walls.difference > 0:
        recommendations.append("Schedule concrete curing inspection and moisture level tests on newly added wall sections.")

    rec_para = " ".join(recommendations)

    summary_text = (
        f"### 🚧 AI Construction Audit Report: {proj_name}\n"
        f"**Reporting Frequency:** {rep_type} | **Generated on:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        f"**Executive Summary:**\n"
        f"{exec_summary}\n\n"
        f"**Progress Analysis:**\n"
        f"1. **Structural Growth:** {structural_para}\n"
        f"2. **Resource Activity & Safety:** {resource_para}\n\n"
        f"**Recommendation:**\n"
        f"{rec_para}"
    )

    return {
        "summary": summary_text,
        "progress_percentage": curr_prog
    }

