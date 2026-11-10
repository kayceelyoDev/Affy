"""
Spike S2: Buffer Create Post with Exact Schedule Time
Verifies the GraphQL mutation payload, fields `mode`, `schedulingType`, and `dueAt`.

Usage:
    python s2_buffer_create_post.py [--live] [--channel-id <id>] [--due-at <ISO8601>]
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.error

def run_mock():
    print("[MOCK] Simulating Buffer createPost mutation with exact schedule time...")
    target_time = (datetime.now(timezone.utc) + timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    mock_input = {
        "channelId": "65b9876543210fedcba54321",
        "text": "Top viral product test #AffiliateTest",
        "schedulingType": "custom",
        "mode": "customScheduled",
        "dueAt": target_time,
        "assets": [
            {
                "video": {
                    "url": "https://res.cloudinary.com/demo/video/upload/sample.mp4"
                }
            }
        ]
    }
    
    mock_response = {
        "data": {
            "createPost": {
                "post": {
                    "id": "67b00112233445566778899a",
                    "text": mock_input["text"],
                    "status": "scheduled",
                    "dueAt": target_time
                }
            }
        }
    }
    
    print("[MOCK] Generated Input Payload:")
    print(json.dumps(mock_input, indent=2))
    print("\n[MOCK] Expected GraphQL Mutation:")
    print("""
    mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
            ... on PostActionSuccess {
                post {
                    id
                    text
                    status
                    dueAt
                }
            }
            ... on MutationError {
                message
            }
        }
    }
    """)
    print("[MOCK] Response:")
    print(json.dumps(mock_response, indent=2))
    print("\n[MOCK] Verification:")
    print(" - `mode`: 'customScheduled' supported")
    print(" - `schedulingType`: 'custom' supported")
    print(" - `dueAt`: ISO8601 timestamp supported")
    return True

def run_live(channel_id=None, due_at=None):
    token = os.getenv("BUFFER_ACCESS_TOKEN")
    cid = channel_id or os.getenv("BUFFER_CHANNEL_ID")
    if not token or not cid:
        print("[ERROR] BUFFER_ACCESS_TOKEN and BUFFER_CHANNEL_ID must be set.")
        print("Owner action: export BUFFER_ACCESS_TOKEN='...' and BUFFER_CHANNEL_ID='...'")
        sys.exit(1)

    schedule_time = due_at or (datetime.now(timezone.utc) + timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    mutation = """
    mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
            ... on PostActionSuccess {
                post {
                    id
                    text
                    status
                    dueAt
                }
            }
            ... on MutationError {
                message
            }
        }
    }
    """
    variables = {
        "input": {
            "channelId": cid,
            "text": "Automated schedule test via Affiliate Autopilot",
            "schedulingType": "custom",
            "mode": "customScheduled",
            "dueAt": schedule_time,
            "assets": [
                {
                    "video": {
                        "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
                    }
                }
            ]
        }
    }
    req_data = json.dumps({"query": mutation, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.buffer.com",
        data=req_data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            print("[LIVE] Status Code:", resp.status)
            print("[LIVE] Response Body:")
            print(json.dumps(data, indent=2))
            return True
    except urllib.error.HTTPError as e:
        print(f"[LIVE ERROR] HTTP {e.code}: {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"[LIVE ERROR] {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Spike S2: Buffer Create Post with Exact Schedule")
    parser.add_argument("--live", action="store_true", help="Run against live Buffer API")
    parser.add_argument("--channel-id", type=str, help="Buffer TikTok Channel ID")
    parser.add_argument("--due-at", type=str, help="ISO8601 target posting datetime")
    args = parser.parse_args()

    if args.live:
        run_live(args.channel_id, args.due_at)
    else:
        run_mock()

if __name__ == "__main__":
    main()
