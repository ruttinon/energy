import omise
import json
from datetime import datetime
from uuid import uuid4

# CONFIG (Ideally moves to env vars later, but hardcoded for now as per instructions)
OMISE_PKEY = "pkey_test_66alsi13fe219qkxfun"
OMISE_SKEY = "skey_test_66alsi2h9w02929rlp0"

omise.api_public = OMISE_PKEY
omise.api_secret = OMISE_SKEY

class OmiseService:
    def create_charge_promptpay(self, amount_thb: float, project_id: str, invoice_id: int):
        """
        Create a Source (PromptPay) then a Charge.
        Amount must be in Satang (multiply by 100).
        """
        try:
            amount_satang = int(amount_thb * 100)
            
            # 1. Create Source
            source = omise.Source.create(
                type="promptpay",
                amount=amount_satang,
                currency="thb"
            )
            
            # 2. Create Charge
            charge = omise.Charge.create(
                amount=amount_satang,
                currency="thb",
                source=source.id,
                return_uri=f"http://localhost:5000/api/billing/callback/omise?inv={invoice_id}", # Placeholder
                metadata={
                    "project_id": project_id,
                    "invoice_id": str(invoice_id),
                    "type": "promptpay"
                }
            )
            
            return {
                "status": "pending",
                "omise_id": charge.id,
                "qr_uri": charge.source.scannable_code.image.download_uri,
                "authorize_uri": charge.authorize_uri
            }
        except Exception as e:
            print(f"[OMISE] Error creating PromptPay charge: {e}")
            raise e

    def create_charge_card(self, amount_thb: float, token: str, project_id: str, invoice_id: int, return_uri: str):
        """
        Create a Charge using a Card Token (from frontend).
        """
        try:
            amount_satang = int(amount_thb * 100)
            
            charge = omise.Charge.create(
                amount=amount_satang,
                currency="thb",
                card=token,
                return_uri=return_uri,
                metadata={
                    "project_id": project_id,
                    "invoice_id": str(invoice_id),
                    "type": "credit_card"
                }
            )
            
            return {
                "status": charge.status, # successful, pending (3DS), or failed
                "omise_id": charge.id,
                "authorize_uri": charge.authorize_uri
            }
        except Exception as e:
            print(f"[OMISE] Error creating Card charge: {e}")
            raise e

    def retrieve_charge(self, charge_id: str):
        return omise.Charge.retrieve(charge_id)

    def verify_webhook_signature(self, signature: str, payload: str):
        # TODO: Implement HMAC check if needed for extra security
        pass
