// frontend/src/utils/convertPrompt.js
export async function convertToMusicPrompt(userInput) {
  const response = await fetch("http://localhost:8000/api/transform_prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_input: userInput }),
  });

  const data = await response.json();
  return data.transformed_prompt || "변환 실패";
}