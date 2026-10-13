"""Map file storage service with atomic writes, path-traversal prevention, and validation."""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

from ..models.map_data import MapData


class StorageService:
    """Safely saves, loads, lists, and validates project map files."""

    def __init__(self, storage_dir: Path | None = None):
        if storage_dir is None:
            # Default to backend/data/maps
            base = Path(__file__).resolve().parent.parent.parent
            self.storage_dir = base / "data" / "maps"
        else:
            self.storage_dir = Path(storage_dir)

        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_filename(self, map_id: str) -> str:
        """Prevent directory traversal attacks and invalid Windows/POSIX filename characters."""
        clean = re.sub(r"[^a-zA-Z0-9_\-]", "_", map_id)
        if not clean or clean.startswith("."):
            clean = f"map_{abs(hash(map_id))}"
        return f"{clean}.json"

    def save_map(self, map_data: MapData) -> Path:
        """Atomically saves MapData model as formatted JSON."""
        filename = self._sanitize_filename(map_data.id)
        target_path = self.storage_dir / filename

        # Atomic write: write to temp file in same directory then atomic replace
        data_str = json.dumps(map_data.model_dump(), indent=2)
        temp_fd, temp_path = tempfile.mkstemp(dir=str(self.storage_dir), prefix="tmp_map_", suffix=".json")
        try:
            with open(temp_fd, "w", encoding="utf-8") as f:
                f.write(data_str)
            os.replace(temp_path, target_path)
        except Exception:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise

        return target_path

    def load_map(self, map_id: str) -> MapData | None:
        """Loads and validates a map file by ID."""
        filename = self._sanitize_filename(map_id)
        target_path = self.storage_dir / filename
        if not target_path.exists():
            return None

        with open(target_path, "r", encoding="utf-8") as f:
            raw_dict = json.load(f)

        return MapData.model_validate(raw_dict)

    def list_maps(self) -> list[dict]:
        """Lists metadata of all available saved maps."""
        maps = []
        for p in self.storage_dir.glob("*.json"):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                maps.append({
                    "id": data.get("id", p.stem),
                    "name": data.get("name", p.stem),
                    "width": data.get("width", 0),
                    "height": data.get("height", 0),
                    "resolution": data.get("resolution", 0.5),
                    "checkpoint_count": len(data.get("checkpoints", [])),
                    "zone_count": len(data.get("zones", [])),
                })
            except Exception:
                continue
        return maps

    def delete_map(self, map_id: str) -> bool:
        """Deletes a saved map file."""
        filename = self._sanitize_filename(map_id)
        target_path = self.storage_dir / filename
        if target_path.exists():
            target_path.unlink()
            return True
        return False
