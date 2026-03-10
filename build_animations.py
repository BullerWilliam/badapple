import cv2
import os
import sys

# Directory containing video files
videos_dir = 'videos'
anims_dir = 'anims'

# Create anims directory if it doesn't exist
os.makedirs(anims_dir, exist_ok=True)

# Check if videos directory exists
if not os.path.exists(videos_dir):
    print(f"[INFO] '{videos_dir}' directory not found. Creating it...")
    os.makedirs(videos_dir, exist_ok=True)
    print("[INFO] No videos to process. Add .mp4 files to the 'videos/' folder and rebuild.")
    print("[INFO] Build completed successfully (no videos to process).")
    sys.exit(0)

# Get all .mp4 files from videos folder
video_files = [f for f in os.listdir(videos_dir) if f.lower().endswith('.mp4')]

if not video_files:
    print(f"[INFO] No .mp4 files found in '{videos_dir}' directory")
    print("[INFO] Build completed successfully (no videos to process).")
    print("[INFO] Tip: Add .mp4 files to the 'videos/' folder and rebuild.")
    sys.exit(0)

print(f"[INFO] Found {len(video_files)} video(s) to process")

# Process each video
for video_file in video_files:
    video_path = os.path.join(videos_dir, video_file)
    anim_name = video_file.replace('.mp4', '').replace('.MP4', '')
    images_dir = os.path.join(anims_dir, anim_name, 'images')
    
    print(f"\n[PROCESSING] {video_file}")
    
    # Create output directory
    os.makedirs(images_dir, exist_ok=True)
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Calculate frame interval (extract 10 FPS)
    frame_interval = int(fps / 10) if fps > 10 else 1
    
    frame_count = 0
    image_count = 1
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_count % frame_interval == 0:
            # Resize to 128x80
            frame = cv2.resize(frame, (128, 80))
            cv2.imwrite(os.path.join(images_dir, f'{image_count}.png'), frame)
            image_count += 1
        
        frame_count += 1
    
    cap.release()
    extracted_count = image_count - 1
    print(f"[SUCCESS] Extracted {extracted_count} frames to '{images_dir}'")

print("\n[COMPLETE] All animations extracted successfully!")

