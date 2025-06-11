# main.py

import os
import uuid
import requests
import base64
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from music_generators import musicgen  # musicgen 모듈

# --- FastAPI 애플리케이션 생성 ---
app = FastAPI()
load_dotenv()

# --- CORS 설정 ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 정적 파일 마운트 ---
AUDIO_DIR = "generated_audios"
SUNO_DIR = os.path.join(AUDIO_DIR, "suno")
MUSICGEN_DIR = os.path.join(AUDIO_DIR, "musicgen")
os.makedirs(SUNO_DIR, exist_ok=True)
os.makedirs(MUSICGEN_DIR, exist_ok=True)
app.mount(f"/{AUDIO_DIR}", StaticFiles(directory=AUDIO_DIR), name="generated_audios")

# --- 모델 정의 ---
class TransformRequest(BaseModel):
    user_input: str

class TransformResponse(BaseModel):
    transformed_prompt: str

class GenerateRequest(BaseModel):
    prompt: str
    generator: str = "suno"

class GenerateResponse(BaseModel):
    url: str
    title: str
    source: str

# --- 프롬프트 변환 ---
@app.post("/api/transform_prompt", response_model=TransformResponse)
async def transform_prompt(req: TransformRequest):
    print("받은 입력:", req.user_input)
    system_prompt = """
You are a music prompt generator. Convert the user's emotional or situational input into a concise, comma-separated music generation prompt. Include elements like mood, genre, tempo, instruments, rhythm, structure, and atmosphere. Do not use full sentences. Just list all elements clearly, separated by commas.
Example Output: tense, ambient cinematic, 70 BPM, low cello drones and dissonant piano hits, repetitive and sparse rhythm, slow build-up to climax then fade-out, eerie and suspenseful
"""
    full_prompt = f"{system_prompt.strip()}\n\nUser input: \"{req.user_input}\"\nOutput:"
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "mistral", "prompt": full_prompt, "stream": False},
            timeout=20,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"LLM 서비스 연결에 실패했습니다: {e}")

    generated = response.json().get("response", "").strip()
    if not generated:
        raise HTTPException(status_code=500, detail="LLM으로부터 유효한 프롬프트를 생성하지 못했습니다.")

    return TransformResponse(transformed_prompt=generated)

# --- Suno 콜백 핸들러 ---
@app.post("/api/suno_callback")
async def suno_callback(request: Request):
    try:
        data = await request.json()
        audio_b64 = data.get("audio_base64")

        if not audio_b64:
            return JSONResponse(status_code=400, content={"error": "audio_base64 누락"})

        audio_bytes = base64.b64decode(audio_b64)
        filename = f"suno_{uuid.uuid4().hex[:8]}.wav"
        filepath = os.path.join(SUNO_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(audio_bytes)

        print(f"[Suno Callback] 저장 완료: {filepath}")
        return {"status": "success", "url": f"/{AUDIO_DIR}/suno/{filename}"}

    except Exception as e:
        print(f"[Suno Callback] 예외 발생: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# --- 음악 생성 ---
@app.post("/api/generate-music", response_model=GenerateResponse)
async def generate_music(req: GenerateRequest):
    prompt = req.prompt
    if not prompt:
        raise HTTPException(status_code=400, detail="프롬프트가 필요합니다.")
    
    if req.generator == "suno":
        SUNO_API_KEY = os.getenv("SUNO_API_KEY")
        if not SUNO_API_KEY:
            raise HTTPException(status_code=500, detail="Suno API 키가 설정되지 않았습니다.")

        try:
            response = requests.post(
                "https://apibox.erweima.ai/api/v1/generate",
                headers={
                    "Authorization": f"Bearer {SUNO_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "prompt": prompt,
                    "duration_seconds": 30,
                    "model": "V4",
                    "instrumental": False,
                    "language": "korean",
                    "customMode": False,
                    "callBackUrl": "http://localhost:8000/api/suno_callback"
                },
                timeout=60,
            )

            print("[Suno API] generate response:", response.status_code, response.text)
            response.raise_for_status()

            task_id = response.json().get("data", {}).get("taskId")
            if not task_id:
                raise HTTPException(status_code=500, detail="Suno API에서 task_id를 받지 못했습니다.")

            # 실제 응답은 콜백을 통해 이뤄지므로, 여기선 경고 메시지
            return JSONResponse(
                status_code=202,
                content={
                    "title": prompt.split(',')[0].strip(),
                    "source": "from Suno",
                    "message": "음악 생성 중입니다. 잠시 후 자동으로 재생됩니다."
                }
            )

        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=503, detail=f"Suno API 호출에 실패했습니다: {e}")

    elif req.generator == "musicgen":
        try:
            result = musicgen.generate_music(prompt)
            if not result:
                raise HTTPException(status_code=500, detail="MusicGen으로 음악 생성에 실패했습니다.")

            file_url = result["url"]
            source = result["source"]
            title = result["title"]

        except Exception as e:
            print("MusicGen 예외 발생:", e)
            raise HTTPException(status_code=500, detail=f"MusicGen 예외 발생: {e}")
    
        title = prompt.split(',')[0].strip()
        return GenerateResponse(url=file_url, title=title, source=source)

    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 생성기입니다.")

    

# --- 서버 실행 ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)