from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import warnings

warnings.filterwarnings("ignore")

app = FastAPI(title="SmolLM2 Chatbot")

# 1. Mount the /static directory so browser can fetch CSS, JS, and images
app.mount("/static", StaticFiles(directory="static"), name="static")

# 2. Load SmolLM2 Model
model_name = "HuggingFaceTB/SmolLM2-360M-Instruct"
print("Loading model...")
tokenizer = AutoTokenizer.from_pretrained(model_name)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    device_map="cpu",
    torch_dtype=torch.float32
)
print("Model ready!")

# 3. Schemas
class ChatRequest(BaseModel):
    prompt: str

class ChatResponse(BaseModel):
    response: str

# 4. Root Route: Serves index.html directly
@app.get("/")
async def serve_index():
    return FileResponse("templates/index.html")

# 5. API Endpoint
@app.post("/chatbot", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        user_text = request.prompt.strip()
        if not user_text:
            raise HTTPException(status_code=400, detail="Empty prompt")

        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_text}
        ]

        tokenized = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
            return_dict=True,
            max_length=512,
            truncation=True
        )

        with torch.inference_mode():
            outputs = model.generate(
                tokenized["input_ids"],
                attention_mask=tokenized["attention_mask"],
                max_new_tokens=60,
                temperature=0.5,
                top_p=0.8,
                do_sample=True,
                repetition_penalty=1.3,
                no_repeat_ngram_size=3,
                pad_token_id=tokenizer.pad_token_id
            )

        new_tokens = outputs[0][tokenized["input_ids"].shape[-1]:]
        bot_response = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

        return ChatResponse(response=bot_response)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))