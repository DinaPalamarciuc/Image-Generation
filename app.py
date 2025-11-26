import io
import json
from typing import Optional, Dict, Any

import streamlit as st
from PIL import Image

from google import genai
from google.genai import types


st.set_page_config(
    page_title="Gemini Image SEO & Prompt Helper",
    page_icon="🎨",
    layout="wide",
)


def get_gemini_client(api_key_input: Optional[str] = None) -> genai.Client:
    api_key = api_key_input or st.secrets.get("GEMINI_API_KEY")

    if not api_key:
        st.error(
            "Nu am găsit nicio cheie Gemini. "
            "Introdu cheia sau seteaz-o în Streamlit Secrets sub GEMINI_API_KEY."
        )
        st.stop()

    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        st.error(f"Eroare la inițializarea clientului Gemini: {e}")
        st.stop()

    return client


def image_to_bytes(img: Image.Image, format: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    return buffer.getvalue()


def extract_json_from_text(text: str) -> Dict[str, Any]:
    text = text.strip()

    if text.startswith("{"):
        return json.loads(text)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start:end + 1])

    raise ValueError("Nu am reușit să extrag JSON valid.")


def analyze_image(client: genai.Client, image: Image.Image, custom_instruction: str):
    img_bytes = image_to_bytes(image)

    base_prompt = """
    You are an expert in SEO copywriting and image prompt engineering.

    Return JSON with:
      - "description": SEO alt text sentence.
      - "seoKeywords": 5-10 keywords.
      - "suggestedPrompt": long detailed image generation prompt.
      - "customAnalysis": paragraph answering user instruction (empty if none).

    JSON only. No explanations.
    """

    if custom_instruction:
        base_prompt += f'\nUser instruction: "{custom_instruction}".'

    parts = [
        types.Part.from_text(base_prompt),
        types.Part.from_bytes(img_bytes, mime_type="image/png")
    ]

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=parts,
    )

    return extract_json_from_text(response.text)


st.title("🎨 Gemini Image SEO & Prompt Helper")

with st.sidebar:
    st.header("Setări")
    api_key_input = st.text_input(
        "Gemini API key",
        type="password",
    )
    st.write("Poți folosi și Streamlit Secrets → GEMINI_API_KEY")

st.subheader("1. Încarcă imaginea")
uploaded_file = st.file_uploader("Upload imagine", type=["png", "jpg", "jpeg"])

st.subheader("2. Instrucțiune opțională")
instruction = st.text_area(
    "Instrucțiune",
    "Scrie descriere și cuvinte cheie potrivite pentru e commerce.",
)

if st.button("Analizează imaginea", type="primary"):
    if not uploaded_file:
        st.error("Încarcă o imagine.")
        st.stop()

    img = Image.open(uploaded_file).convert("RGB")
    st.image(img, caption="Imagine încărcată", use_column_width=True)

    with st.spinner("Analizez imaginea..."):
        client = get_gemini_client(api_key_input)
        result = analyze_image(client, img, instruction)

    st.success("Gata!")

    st.markdown("### Descriere")
    st.write(result.get("description", ""))

    st.markdown("### Cuvinte cheie")
    for kw in result.get("seoKeywords", []):
        st.write("-", kw)

    st.markdown("### Prompt generare imagine")
    st.text_area("Prompt", result.get("suggestedPrompt", ""), height=250)

    st.markdown("### Analiză personalizată")
    st.write(result.get("customAnalysis", ""))

    st.markdown("### JSON complet")
    st.code(json.dumps(result, indent=2, ensure_ascii=False), language="json")
