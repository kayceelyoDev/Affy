"""
Spike S1: Buffer Post Metrics
Tests fetching metrics (views, impressions, likes, comments) for a TikTok post via Buffer GraphQL API.

Usage:
    python s1_buffer_metrics.py [--live] [--post-id <id>]
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error

def run_mock():
    print("[MOCK] Simulating Buffer post metrics query...")
    mock_response = {
        "data": {
            "post": {
                "id": "67a1234567890abcdef12345",
                "text": "Check out this amazing budget gadget! #TikTokMadeMeBuyIt",
                "createdAt": "2026-11-08T04:30:00.000Z",
                "dueAt": "2026-11-08T05:00:00.000Z",
                "status": "sent",
                "metrics": {
                    "views": 4250,
                    "impressions": 5890,
                    "likes": 312,
                    "comments": 18,
                    "shares": 45,
                    "clicks": 88
                }
            }
        },
        "extensions": {
            "cost": {
                "requestedQueryCost": 2,
                "actualQueryCost": 2,
                "throttleStatus": {
                    "maximumAvailable": 1000,
                    "currentlyAvailable": 998,
                    "restoreRate": 50
                }
            }
        }
    }
    print("[MOCK] Response:")
    print(json.dumps(mock_response, indent=2))
    print("[MOCK] Verification:")
    print(" - Views present: Yes (4250)")
    print(" - Impressions present: Yes (5890)")
    print(" - Rate limit headers/quota info simulated successfully.")
    return True

def run_live(post_id=None):
    token = os.getenv("BUFFER_ACCESS_TOKEN")
    if not token:
        print("[ERROR] BUFFER_ACCESS_TOKEN environment variable is not set.")
        print("Owner action: export BUFFER_ACCESS_TOKEN='...' before running live spike.")
        sys.exit(1)

    url = "https://api.buffer.com"
    query = """
    query GetPostMetrics($id: ID!) {
        post(id: $id) {
            id
            text
            status
            dueAt
            metrics {
                views
                impressions
                likes
                comments
                shares
                clicks
            }
        }
    }
    """
    variables = {"id": post_id or "mock_id"}
    req_data = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            headers = dict(resp.info())
            body = resp.read().decode("utf-8")
            print("[LIVE] Status Code:", resp.status)
            print("[LIVE] Rate Limit Headers:")
            for k, v in headers.items():
                if "rate" in k.lower() or "limit" in k.lower():
                    print(f"  {k}: {v}")
            data = json.loads(body)
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
    parser = argparse.ArgumentParser(description="Spike S1: Buffer Post Metrics")
    parser.add_argument("--live", action="store_true", help="Run against live Buffer API")
    parser.add_argument("--post-id", type=str, help="Post ID to query metrics for")
    args = parser.parse_args()

    if args.live:
        run_live(args.post_id)
    else:
        run_mock()

if __name__ == "__main__":
    main()
