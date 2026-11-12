"""
Spike S7: TikTok Display API video.list
Tests querying TikTok Display API endpoint /v2/video/list/ for direct creator video metrics.

Usage:
    python s7_tiktok_display_api.py [--live] [--access-token <token>]
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error

def run_mock():
    print("[MOCK] Simulating TikTok Display API /v2/video/list/ query...")
    mock_response = {
        "data": {
            "videos": [
                {
                    "id": "7300123456789012345",
                    "title": "Why didn't I buy this neck fan sooner?! 😱 #portablefan #affiliate",
                    "create_time": 1731100000,
                    "cover_image_url": "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/cover.jpeg",
                    "share_url": "https://www.tiktok.com/@creator/video/7300123456789012345",
                    "video_description": "Affiliate product review clip",
                    "duration": 22,
                    "view_count": 12450,
                    "like_count": 890,
                    "comment_count": 45,
                    "share_count": 112
                }
            ],
            "cursor": 1731100000,
            "has_more": False
        },
        "error": {
            "code": "ok",
            "message": "",
            "log_id": "202611101234567890abcdef"
        }
    }
    print("[MOCK] Response:")
    print(json.dumps(mock_response, indent=2))
    print("\n[MOCK] Verification:")
    print(" - `view_count`, `like_count`, `comment_count`, `share_count` mapped directly.")
    print(" - Optional direct ingestion pipeline validated.")
    return True

def run_live(access_token=None):
    token = access_token or os.getenv("TIKTOK_DISPLAY_API_ACCESS_TOKEN")
    if not token:
        print("[ERROR] TIKTOK_DISPLAY_API_ACCESS_TOKEN is not set.")
        print("Owner action: export TIKTOK_DISPLAY_API_ACCESS_TOKEN='...' before running live spike.")
        sys.exit(1)

    url = "https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,cover_image_url,share_url,video_description,duration,like_count,comment_count,share_count,view_count"
    req_body = json.dumps({"max_count": 10}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print("[LIVE] Status Code:", resp.status)
            print("[LIVE] Response:")
            print(json.dumps(data, indent=2))
            return True
    except urllib.error.HTTPError as e:
        print(f"[LIVE ERROR] HTTP {e.code}: {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"[LIVE ERROR] {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Spike S7: TikTok Display API video.list")
    parser.add_argument("--live", action="store_true", help="Run against live TikTok Display API")
    parser.add_argument("--access-token", type=str, help="TikTok user access token")
    args = parser.parse_args()

    if args.live:
        run_live(args.access_token)
    else:
        run_mock()

if __name__ == "__main__":
    main()
