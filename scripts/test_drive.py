import asyncio
import json
from backend.app.services.vault import VaultService
from backend.app.services.storage.drive_api import GoogleDriveAPIClient

async def test():
    vault = VaultService()
    sa_json = vault.get_secret("GOOGLE_DRIVE_SERVICE_ACCOUNT")
    print("Found SA JSON:", bool(sa_json))
    if not sa_json:
        return
    data = json.loads(sa_json)
    print("Client Email:", data.get("client_email"))
    client = GoogleDriveAPIClient(service_account_info=data)
    folder_id = "1E8RKxQ_j99CCMchUxYoO2ioSDcFL9U85"
    print("Listing folder:", folder_id)
    try:
        items = await client.list_files(folder_id)
        print(f"Success! Found {len(items)} items:")
        for i in items:
            print(f" - {i.get('name')} ({i.get('mimeType')})")
    except Exception as e:
        print("Error:", type(e), e)

if __name__ == "__main__":
    asyncio.run(test())
