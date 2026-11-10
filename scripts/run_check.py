import sys
import subprocess

def run_command(cmd, desc):
    print(f"\n[RUNNING] {desc}: {' '.join(cmd)}")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print(f"[FAILED] {desc} exited with code {res.returncode}")
        sys.exit(res.returncode)
    print(f"[PASSED] {desc}")

def main():
    print("==================================================")
    print("Affiliate Autopilot: Validation Check Suite")
    print("==================================================")

    # 1. Inventory check (148/148 nodes)
    run_command([sys.executable, "scripts/check_inventory.py"], "Workflow Node Inventory Check")

    # 2. Secret scan
    run_command([sys.executable, "scripts/scan_secrets.py"], "Secrets & Credential Leak Scan")

    # 3. Old editor untouched verification
    run_command([sys.executable, "scripts/verify_old_editor_untouched.py"], "Old Editor Folder Integrity Check")

    print("\n==================================================")
    print("ALL PRE-BUILD SYSTEM CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    main()
