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
    print(f"Error: '{videos_dir}' directory not found")
    sys.exit(1)

# Get all .mp4 files from videos folder
video_files = [f for f in os.listdir(videos_dir) if f.lower().endswith('.mp4')]

if not video_files:
    print(f"No .mp4 files found in '{videos_dir}' directory")
    sys.exit(1)

print(f"Found {len(video_files)} video(s) to process")

# Process each video
for video_file in video_files:
    video_path = os.path.join(videos_dir, video_file)
    anim_name = video_file.replace('.mp4', '').replace('.MP4', '')
    images_dir = os.path.join(anims_dir, anim_name, 'images')
    
    print(f"\nProcessing: {video_file}")
    
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
    print(f"Extracted {image_count-1} frames to '{images_dir}'")

print("\nDone! All animations extracted successfully.")
