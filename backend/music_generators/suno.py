import os
import uuid
import requests

# SUNO API 설정
API_KEY = os.getenv("SUNO_API_KEY")
API_URL = "https://apibox.erweima.ai/api/v1/generate"
OUTPUT_DIR = "generated_audios/suno"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_music(prompt: str) -> dict | None:
    if not API_KEY:
        print("[Suno] SUNO_API_KEY 환경변수 없음")
        return None

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    data = {
        "prompt": prompt,
        "duration_seconds": 30,  # 길이는 필요 시 조절 가능
    }

    try:
        response = requests.post(API_URL, headers=headers, json=data)
        if response.status_code != 200:
            print(f"[Suno] 오류: {response.status_code} - {response.text}")
            return None

        # 바이너리 오디오가 응답 본문에 직접 포함된다고 가정
        filename = f"suno_{uuid.uuid4().hex[:8]}.wav"
        filepath = os.path.join(OUTPUT_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(response.content)

        return {
            "url": f"http://localhost:8000/generated_audios/suno/{filename}",
            "title": "Suno Output",
            "source": "from Suno"
        }

    except Exception as e:
        print(f"[Suno] 예외 발생: {e}")
        return None