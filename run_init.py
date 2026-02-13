from services.backend.api.project_init import init_project_db
import system_audit as audit_script

ACTIVE_PROJECT = "CPRAM-639ec8"

print("🔄 Running Manual Init...")
init_project_db(ACTIVE_PROJECT)
print("\n✅ Init Complete. Running Audit...")
print("-" * 20)
audit_script.ACTIVE_PROJECT = ACTIVE_PROJECT
audit_script.main()
