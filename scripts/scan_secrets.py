import os
import re
import sys

# High sensitivity regex patterns for credentials
PATTERNS = [
    (re.compile(r"(?i)(?:api_key|apikey|secret|token|password|auth_token)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]"), "Generic API Key/Secret"),
    (re.compile(r"[0-9]{8,10}:[a-zA-Z0-9_-]{35}"), "Telegram Bot Token"),
    (re.compile(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{20,}"), "Bearer Token"),
    (re.compile(r"-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----"), "Private Key"),
    (re.compile(r"AIza[0-9A-Za-z-_]{35}"), "Google API Key"),
    (re.compile(r"(?i)cloudinary://[0-9]+:[a-zA-Z0-9_\-]+@[a-zA-Z0-9_\-]+"), "Cloudinary URL"),
]

# Allowlisted files and words
ALLOWLIST_FILES = {
    ".gitignore",
    ".gitleaks.toml",
    "legacy_private",
}

ALLOWLIST_PATTERNS = [
    re.compile(r"YOUR_[A-Z0-9_]+_HERE"),
    re.compile(r"mock-[a-zA-Z0-9_-]+"),
    re.compile(r"test-[a-zA-Z0-9_-]+"),
    re.compile(r"67a1234567890abcdef12345"),
    re.compile(r"65b9876543210fedcba54321"),
    re.compile(r"67b00112233445566778899a"),
]

root_dir = r"\\192.168.1.7\TiktokCreator"
findings = 0

for root, dirs, files in os.walk(root_dir):
    # Skip ignored dirs
    if "legacy_private" in root or ".git" in root or "node_modules" in root or "__pycache__" in root:
        continue
    for file in files:
        if file in ALLOWLIST_FILES:
            continue
        filepath = os.path.join(root, file)
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            for pattern, desc in PATTERNS:
                matches = pattern.findall(content)
                for match in matches:
                    # check allowlist
                    if any(allow.search(match) for allow in ALLOWLIST_PATTERNS):
                        continue
                    print(f"[POTENTIAL SECRET] {desc} in {os.path.relpath(filepath, root_dir)}: {match[:20]}...")
                    findings += 1
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

if findings == 0:
    print("Secret scan PASSED: 0 secrets found across all tracked files.")
else:
    print(f"Secret scan FAILED: {findings} findings.")
    sys.exit(1)
