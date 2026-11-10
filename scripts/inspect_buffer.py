import json

wf_path = r"\\192.168.1.7\TiktokCreator\legacy_private\workflows\workflow_4_google_drive_to_gemini_to_buffer_tiktok_poster.json"
with open(wf_path, "r", encoding="utf-8") as f:
    w = json.load(f)

for node in w.get("nodes", []):
    if "buffer" in node.get("name", "").lower() or "buffer" in node.get("type", "").lower():
        print("=== NODE:", node.get("name"), "===")
        print(json.dumps(node.get("parameters", {}), indent=2))
