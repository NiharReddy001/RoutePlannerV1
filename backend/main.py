"""Main entrypoint for FastAPI route planning and simulation server."""

from contextlib import asynccontextmanager

from app.api.routes import router
from app.services.sample_maps import get_default_sample_map
from app.services.storage import StorageService
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage = StorageService()
    if not storage.list_maps():
        sample = get_default_sample_map()
        storage.save_map(sample)
    yield


app = FastAPI(
    title="MDP Mission-Aware Autonomous Patrol Route Planner API",
    description="Backend planning engine and execution simulation for single-robot autonomous patrol.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration restricted to local development origins
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
