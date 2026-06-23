from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import os
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

@app.post("/process")
@app.post("/api/process")
async def process_video(payload: ProcessPayload):
    # Resolve storage paths
    storage_root = os.getenv("STORAGE_ROOT", "../storage")
    video_path = os.path.abspath(payload.file_path)
    
    if not os.path.exists(video_path):
        # Try finding it relative to storage root if absolute path check fails due to OS differences
        alt_path = os.path.abspath(os.path.join(storage_root, "uploads", os.path.basename(payload.file_path)))
        if os.path.exists(alt_path):
            video_path = alt_path
        else:
            raise HTTPException(status_code=404, detail=f"Video file not found at {video_path}")
            
    output_dir = os.path.abspath(os.path.join(storage_root, "uploads", "frames", payload.media_id))
    os.makedirs(output_dir, exist_ok=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail=f"Failed to open video file: {video_path}")
        
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
            frame_detections = detector.detect(frame_save_path, payload.media_id, t)
        except Exception as e:
            print(f"Failed to run detection on frame at t={t}: {e}")
            frame_detections = []
            
        # Save relative path or absolute path. Let's save absolute path for backend consumption
        frames_list.append({
            "timestamp": t,
            "frame_path": frame_save_path,
            "detections": frame_detections
        })
        
        t += payload.interval
        
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
        "media_id": payload.media_id,
        "frames": frames_list
    }
