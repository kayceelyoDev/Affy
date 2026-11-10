import json

transcript_path = r"C:\Users\kaycee\.gemini\antigravity\brain\7c086724-e170-425a-8810-5c46c5a09262\.system_generated\logs\transcript_full.jsonl"
prompt_out_path = r"\\192.168.1.7\TiktokCreator\docs\PROMPT.md"

with open(transcript_path, "r", encoding="utf-8") as f:
    first_line = f.readline()
    data = json.loads(first_line)
    content = data.get("content", "")

# Strip any leading <USER_REQUEST> tags if present
if content.startswith("<USER_REQUEST>"):
    content = content[len("<USER_REQUEST>"):].lstrip()
if "</USER_REQUEST>" in content:
    content = content.split("</USER_REQUEST>")[0].rstrip()

with open(prompt_out_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully extracted full prompt to {prompt_out_path} ({len(content)} characters)")
