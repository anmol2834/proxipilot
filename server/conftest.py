import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    # .env fills in only what the environment does not set: an explicit variable (e.g. a
    # REDIS_URL pointing at an isolated test Redis) must win, so a QA run can be isolated
    # from shared infrastructure instead of being forced onto the .env services.
    load_dotenv(env_path, override=False)

