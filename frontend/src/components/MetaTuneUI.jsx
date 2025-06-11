// frontend/src/components/MetaTuneUI.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
// convertPrompt.js 유틸은 이전 답변의 것을 그대로 사용하면 됩니다.
import { convertToMusicPrompt } from '../utils/convertPrompt';

export default function MetaTuneUI() {
  const [darkMode, setDarkMode] = useState(false);
  const [mode, setMode] = useState('prompt');
  const [status, setStatus] = useState('');
  const [taskId, setTaskId] = useState(null);
  
  // ⭐️ 디테일 모드 상태 추가
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [instruments, setInstruments] = useState(['']);
  const [lyrics, setLyrics] = useState('');
  const [other, setOther] = useState('');

  const [convertedPrompt, setConvertedPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [musicList, setMusicList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [musicData, setMusicData] = useState(null);

  // ⭐️ 악기 입력 변경 핸들러
  const handleInstrumentChange = (index, value) => {
    const newInstruments = [...instruments];
    newInstruments[index] = value;
    setInstruments(newInstruments);
  };

  // ⭐️ 악기 입력 필드 추가
  const addInstrument = () => {
    setInstruments([...instruments, '']);
  };

  // ⭐️ 디테일 모드에서 음악 생성
  const handleDetailConvert = async () => {
    const detailParts = [
      genre && `Genre: ${genre}`,
      mood && `Mood: ${mood}`,
      instruments.filter(inst => inst).length > 0 && `Instruments: ${instruments.filter(inst => inst).join(', ')}`,
      lyrics && `Lyrics: ${lyrics}`,
      other && `Other details: ${other}`,
    ].filter(Boolean); // 비어있지 않은 요소만 필터링

    if (detailParts.length === 0) {
      alert('하나 이상의 필드를 입력해주세요.');
      return;
    }
    const prompt = detailParts.join('. ');
    await generateMusic(prompt);
  };


  const generateMusic = async (prompt) => {
    setLoading(true);
    setConvertedPrompt(prompt);
    setMusicData(null);
    setStatus('');

    try {
      const response = await fetch('http://localhost:8000/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, generator: "suno" }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || '음악 생성 실패');
      }

      const data = await response.json();

      if (response.status === 202 && data.task_id) {
        setStatus('음악 생성 중...');
        setTaskId(data.task_id);
        pollForResult(data.task_id);
      } else if (response.ok && data.url) {
        setStatus('음악 생성 완료!');
        const newMusic = {
          url: data.url,
          title: data.title || `Generated Song #${musicList.length + 1}`,
          source: data.source || 'from MetaTune',
        };
        const updatedList = [...musicList, newMusic];
        setMusicList(updatedList);
        setCurrentIndex(updatedList.length - 1);
        setMusicData(newMusic);
      } else {
        throw new Error('유효한 응답이 아닙니다.');
      }
    } catch (error) {
      alert(`음악 생성 중 오류 발생: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptConvert = async () => {
    const input = document.querySelector("textarea").value;
    if (!input) {
      alert('프롬프트를 입력해주세요.');
      return;
    }
    const prompt = await convertToMusicPrompt(input);
    console.log("변환된 프롬프트:", prompt);  // 디버깅용 로그
    await generateMusic(prompt);
  };
  
  // ⭐️ 버그 수정: useEffect를 사용하여 currentIndex 변경 시 musicData를 업데이트
  useEffect(() => {
    if (musicList.length > 0) {
      setMusicData(musicList[currentIndex]);
    }
  }, [currentIndex, musicList]);

  const prevMusic = () => {
    if (musicList.length === 0) return;
    setCurrentIndex((prevIdx) => (prevIdx === 0 ? musicList.length - 1 : prevIdx - 1));
  };

  const nextMusic = () => {
    if (musicList.length === 0) return;
    setCurrentIndex((prevIdx) => (prevIdx === musicList.length - 1 ? 0 : prevIdx + 1));
  };

  const baseBorder = darkMode ? 'border-white' : 'border-black';
  const baseText = darkMode ? 'text-white' : 'text-black';
  const baseBg = darkMode ? 'bg-black' : 'bg-[#FCFBF4]';
  const invertedBg = darkMode ? 'bg-white text-black' : 'bg-black text-white';

  return (
    <div className={`min-h-screen w-full px-4 py-6 transition-colors duration-300 flex flex-col items-center justify-center relative ${baseBg} ${baseText}`}>
      <div className="absolute top-4 right-4">
        <div onClick={() => setDarkMode(!darkMode)} className={`w-10 h-10 ${baseBorder} border-2 rounded-full flex items-center justify-center cursor-pointer`}>
          {darkMode ? '☀️' : '🌙'}
        </div>
      </div>

      <div className="text-4xl font-bold mb-8 select-none">🎷MetaTune</div>

      <div className="flex justify-center gap-4 mb-6">
        {['prompt', 'detail'].map((m) => (
          <div key={m} onClick={() => setMode(m)} className={`px-6 py-2 rounded-full cursor-pointer border ${baseBorder} ${mode === m ? (darkMode ? 'bg-white text-black' : 'bg-black text-white') : 'bg-transparent'}`}>
            {m === 'prompt' ? '프롬프트' : '디테일'}
          </div>
        ))}
      </div>

      {mode === 'prompt' && !loading && !musicData && (
        <div className="relative w-full max-w-4xl mx-auto">
          <textarea className="w-full h-[60vh] p-4 border rounded-xl resize-none bg-transparent placeholder-gray-400" placeholder="지금 어떤 기분인가요?" />
          <div onClick={handlePromptConvert} className={`absolute bottom-4 right-4 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer ${invertedBg} border ${baseBorder} select-none`}>
            ⬆️
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className={`w-16 h-16 border-4 border-t-4 border-gray-300 rounded-full animate-spin ${darkMode ? 'border-white border-t-black' : 'border-black border-t-white'}`}></div>
          <div className="text-lg italic select-none">당신의 음악 생성 중...</div>
        </div>
      )}

      {musicData && !loading && (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4">
          <div className="flex justify-between w-full mb-4 select-none">
            <button onClick={prevMusic} className={`text-4xl font-bold px-4 ${baseText} hover:opacity-70`} aria-label="Previous Music">←</button>
            <button onClick={nextMusic} className={`text-4xl font-bold px-4 ${baseText} hover:opacity-70`} aria-label="Next Music">→</button>
          </div>
          <div className="text-center mb-4">
            <h2 className="text-3xl font-semibold">{musicData.title}</h2>
            <p className="text-sm italic text-gray-400">{musicData.source}</p>
          </div>
          <audio src={musicData.url} controls autoPlay className="w-full rounded-lg shadow-lg" key={musicData.url} />
          <div className="mt-6 flex justify-center space-x-4">
            <button className={`px-4 py-2 rounded-md border ${baseBorder} ${baseText} hover:bg-gray-200 hover:text-black transition`}>공유하기</button>
          </div>
        </div>
      )}

      {mode === 'detail' && !loading && !musicData && (
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium">장르</div>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full p-2 border rounded-md bg-transparent" placeholder="예: jazz, lofi, EDM" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">분위기</div>
            <input value={mood} onChange={(e) => setMood(e.target.value)} className="w-full p-2 border rounded-md bg-transparent" placeholder="예: 몽환적인, 신나는, 차분한" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">사용할 악기</div>
            {instruments.map((inst, idx) => (
              <input key={idx} value={inst} onChange={(e) => handleInstrumentChange(idx, e.target.value)} className="w-full p-2 border rounded-md mb-2 bg-transparent" placeholder={`예: 피아노, 기타, 드럼`} />
            ))}
            <button onClick={addInstrument} className={`text-sm px-4 py-2 rounded-md transition-colors duration-300 ${darkMode ? 'bg-white text-black' : 'bg-[#FCFBF4] text-black border border-black'}`}>악기 추가</button>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">가사 (선택)</div>
            <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} className="w-full p-2 border rounded-md h-20 resize-none bg-transparent" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">기타 (ex. 제목 등)</div>
            <textarea value={other} onChange={(e) => setOther(e.target.value)} className="w-full p-2 border rounded-md h-20 resize-none bg-transparent" />
          </div>
          <div className="flex justify-end">
             {/* ⭐️ 디테일 모드 생성 버튼에 핸들러 연결 */}
            <div onClick={handleDetailConvert} className={`w-12 h-12 flex items-center justify-center rounded-full cursor-pointer ${darkMode ? 'bg-white text-black border border-white' : 'bg-black text-white border border-black'}`}>
              ⬆️
            </div>
          </div>
        </div>
      )}
    </div>
  );
}