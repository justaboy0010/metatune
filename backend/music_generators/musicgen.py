import requests
import os
import uuid
import base64

# musicgen 음원 저장 폴더
OUTPUT_DIR = "generated_audios/musicgen"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_music(prompt: str) -> dict | None:
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "musicgen",
                "prompt": prompt,
                "stream": False
            }
        )

        if response.status_code != 200:
            print(f"[MusicGen] 실패: {response.text}")
            return None

        audio_b64 = response.json().get("audio")
        if not audio_b64:
            print("[MusicGen] 응답에 audio 데이터 없음")
            return None

        audio_bytes = base64.b64decode(audio_b64)
        filename = f"musicgen_{uuid.uuid4().hex[:8]}.wav"
        filepath = os.path.join(OUTPUT_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(audio_bytes)

        return {
            "url": f"http://localhost:8000/generated_audios/musicgen/{filename}",
            "title": f"MusicGen Output",
            "source": "from MusicGen"
        }

    except Exception as e:
        print(f"[MusicGen] 예외 발생: {e}")
        return None