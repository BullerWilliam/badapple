import cv2
import os

cap = cv2.VideoCapture('birds.mp4')
fps = cap.get(cv2.CAP_PROP_FPS)
interval = int(fps / 10) if fps > 10 else 1

os.makedirs('images', exist_ok=True)

frame_count = 0
image_count = 1

while True:
    ret, frame = cap.read()
    if not ret:
        break
    if frame_count % interval == 0:
        frame = cv2.resize(frame, (128, 80))
        cv2.imwrite(f'images/{image_count}.png', frame)
        image_count += 1
    frame_count += 1

cap.release()
print(f"Extracted {image_count-1} images to 'images' folder.")