Place the following wheel files here (matching your Python version & platform) before installing offline:

- fastapi-*.whl
- uvicorn-*.whl
- pydantic-*.whl
- any other dependencies you need

Example to install in a virtualenv (from project root):

python -m venv .venv
.venv\Scripts\activate   # Windows
pip install --no-index --find-links=./vendor_wheels -r services/backend/requirements.txt

Then run the FastAPI app:
uvicorn services.backend.fastapi_app:app --host 0.0.0.0 --port 8300
