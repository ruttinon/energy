import pandas as pd
import os

# Create directory if not exists
os.makedirs("services/backend/api/report_builder/templates", exist_ok=True)

#
df = pd.DataFrame({
    'Parameter': ['Total Energy', 'Total Cost'],
    'Value': [0, 0]
})

# Write to Excel
path = "services/backend/api/report_builder/templates/billing_summary.xlsx"
df.to_excel(path, index=False)
print(f"Created {path}")
