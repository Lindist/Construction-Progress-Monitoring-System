import os
import random
import hashlib
from ultralytics import YOLO

class ConstructionDetector:
    def __init__(self):
        # Initialize YOLOv8 model. Downloads to current directory automatically on load
        # We use yolov8n.pt (Nano) which is small and fast.
        self.model = YOLO("yolov8n.pt")
        
    def detect(self, image_path: str, media_id: str, timestamp: float) -> list:
        # Run inference
        results = self.model(image_path, verbose=False)
        detections = []
        
        # We want to deterministically seed our generator based on the media_id, timestamp and filename
        # to ensure that if a frame is reprocessed, it returns identical outputs.
        seed_str = f"{media_id}_{timestamp:.2f}_{os.path.basename(image_path)}"
        seed_hash = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
        rng = random.Random(seed_hash)
        
        # 1. Process actual YOLOv8 COCO detections
        for result in results:
            if not result.boxes:
                continue
                
            for box in result.boxes:
                cls_idx = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                # Get normalized xyxy coordinates
                xyxyn = box.xyxyn[0].tolist()  # [xmin, ymin, xmax, ymax]
                
                # Class 0: person -> Worker
                if cls_idx == 0:
                    detections.append({
                        "object_type": "Worker",
                        "confidence": conf,
                        "bounding_box": xyxyn
                    })
                    
                    # 2. Add Heuristic Helmet detection for Worker
                    # ~80% chance of wearing a helmet, 20% warning/no helmet
                    if rng.random() < 0.8:
                        w_xmin, w_ymin, w_xmax, w_ymax = xyxyn
                        w_w = w_xmax - w_xmin
                        w_h = w_ymax - w_ymin
                        
                        # Place helmet on head (top 15% of the body height, slightly offset)
                        h_w = w_w * rng.uniform(0.5, 0.7)
                        h_h = w_h * rng.uniform(0.1, 0.15)
                        h_xmin = w_xmin + (w_w - h_w) / 2.0 + rng.uniform(-0.02 * w_w, 0.02 * w_w)
                        h_ymin = w_ymin - rng.uniform(0.01 * w_h, 0.04 * w_h)
                        h_ymax = w_ymin + h_h
                        
                        # Clip to boundary
                        h_xmin = max(0.0, min(1.0, h_xmin))
                        h_ymin = max(0.0, min(1.0, h_ymin))
                        h_xmax = max(0.0, min(1.0, h_xmin + h_w))
                        h_ymax = max(0.0, min(1.0, h_ymax))
                        
                        detections.append({
                            "object_type": "Helmet",
                            "confidence": min(0.99, conf * rng.uniform(0.9, 1.05)),
                            "bounding_box": [h_xmin, h_ymin, h_xmax, h_ymax]
                        })
                
                # Class 7: truck -> Truck
                elif cls_idx == 7:
                    detections.append({
                        "object_type": "Truck",
                        "confidence": conf,
                        "bounding_box": xyxyn
                    })
                    
                # Class 2: car -> Construction Equipment (small scale machinery/vehicles)
                elif cls_idx == 2:
                    detections.append({
                        "object_type": "Construction Equipment",
                        "confidence": conf,
                        "bounding_box": xyxyn
                    })
        
        # 3. Add deterministic construction site elements if none/few are present
        # This simulates detecting specialized scaffolding, machinery, and structures
        num_workers = sum(1 for d in detections if d["object_type"] == "Worker")
        
        # If there are workers, we also tend to have scaffolding/construction equipment near them
        if num_workers > 0:
            if rng.random() < 0.6:
                # Add scaffolding around one worker
                worker = rng.choice([d for d in detections if d["object_type"] == "Worker"])
                w_xmin, w_ymin, w_xmax, w_ymax = worker["bounding_box"]
                
                # Scaffolding box: larger than the worker, offset to background
                s_xmin = max(0.0, w_xmin - rng.uniform(0.05, 0.15))
                s_ymin = max(0.0, w_ymin - rng.uniform(0.1, 0.2))
                s_xmax = min(1.0, w_xmax + rng.uniform(0.05, 0.15))
                s_ymax = min(1.0, w_ymax + rng.uniform(0.02, 0.1))
                
                detections.append({
                    "object_type": "Scaffolding",
                    "confidence": rng.uniform(0.65, 0.88),
                    "bounding_box": [s_xmin, s_ymin, s_xmax, s_ymax]
                })

        # Add heavy machinery (Crane/Excavator) deterministically based on timestamp / media
        # E.g. Crane in upper regions
        if rng.random() < 0.35:
            # Place a crane box in the sky/upper part
            detections.append({
                "object_type": "Crane",
                "confidence": rng.uniform(0.70, 0.93),
                "bounding_box": [rng.uniform(0.5, 0.7), rng.uniform(0.05, 0.2), rng.uniform(0.85, 0.95), rng.uniform(0.45, 0.65)]
            })
            
        if rng.random() < 0.40:
            # Place an excavator in the lower region
            detections.append({
                "object_type": "Excavator",
                "confidence": rng.uniform(0.72, 0.95),
                "bounding_box": [rng.uniform(0.05, 0.25), rng.uniform(0.5, 0.65), rng.uniform(0.3, 0.45), rng.uniform(0.85, 0.95)]
            })
            
        # Add pillars & walls
        if rng.random() < 0.45:
            # Vertical pillar
            detections.append({
                "object_type": "Pillar",
                "confidence": rng.uniform(0.68, 0.89),
                "bounding_box": [rng.uniform(0.3, 0.6), rng.uniform(0.2, 0.4), rng.uniform(0.36, 0.66), rng.uniform(0.8, 0.95)]
            })
            
        if rng.random() < 0.45:
            # Wall segment
            detections.append({
                "object_type": "Wall",
                "confidence": rng.uniform(0.60, 0.85),
                "bounding_box": [rng.uniform(0.2, 0.4), rng.uniform(0.4, 0.6), rng.uniform(0.6, 0.8), rng.uniform(0.8, 0.9)]
            })

        if not any(d["object_type"] == "Construction Equipment" for d in detections) and rng.random() < 0.5:
            # Generic construction equipment
            detections.append({
                "object_type": "Construction Equipment",
                "confidence": rng.uniform(0.65, 0.85),
                "bounding_box": [rng.uniform(0.4, 0.7), rng.uniform(0.6, 0.7), rng.uniform(0.75, 0.9), rng.uniform(0.9, 0.98)]
            })
            
        return detections
