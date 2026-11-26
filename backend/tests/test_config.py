from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.app.core.config import Settings


def test_settings_load_from_an_env_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("NEXUSAI_DOCS_ENABLED", raising=False)
    monkeypatch.delenv("NEXUSAI_DATABASE_URL", raising=False)
    path = tmp_path / ".env"
    path.write_text("NEXUSAI_DOCS_ENABLED=false\nNEXUSAI_DATABASE_URL=\n", encoding="utf-8")

    settings = Settings(_env_file=path)

    assert settings.docs_enabled is False
    assert settings.database_url is None


def test_invalid_database_url_is_rejected_without_disclosing_its_value() -> None:
    with pytest.raises(ValidationError, match="PostgreSQL connection URL") as error:
        Settings(_env_file=None, database_url="invalid-confidential-value")

    assert "invalid-confidential-value" not in str(error.value)
