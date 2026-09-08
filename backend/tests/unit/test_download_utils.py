"""Tests for scripts._download_utils."""

import tarfile
from pathlib import Path

import pytest

from scripts._download_utils import find_lemma_directory
from scripts._download_utils import is_local_tarball
from scripts._download_utils import is_remote_source
from scripts._download_utils import resolve_data_dir
from scripts._download_utils import safe_extract_tarball


class TestIsRemoteSource:
    def test_https_url(self) -> None:
        assert is_remote_source("https://example.com/data.tar.gz") is True

    def test_http_url(self) -> None:
        assert is_remote_source("http://example.com/data.tar.gz") is False

    def test_local_path(self) -> None:
        assert is_remote_source("data.tar.gz") is False

    def test_file_url(self) -> None:
        assert is_remote_source("file://data.tar.gz") is False

    def test_empty_string(self) -> None:
        assert is_remote_source("") is False


class TestIsLocalTarball:
    def test_existing_tar_gz(self, tmp_path: Path) -> None:
        archive = tmp_path / "data.tar.gz"
        archive.write_text("")
        assert is_local_tarball(archive) is True

    def test_non_tar_file(self, tmp_path: Path) -> None:
        plain = tmp_path / "data.json"
        plain.write_text("{}")
        assert is_local_tarball(plain) is False

    def test_nonexistent_path(self, tmp_path: Path) -> None:
        assert is_local_tarball(tmp_path / "missing.tar.gz") is False


class TestSafeExtractTarball:
    def _create_tarball(self, archive_path: Path, files: dict[str, str]) -> None:
        with tarfile.open(archive_path, "w:gz") as tar:
            for name, content in files.items():
                import io

                data = content.encode("utf-8")
                info = tarfile.TarInfo(name=name)
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))

    def test_extracts_files(self, tmp_path: Path) -> None:
        archive = tmp_path / "data.tar.gz"
        self._create_tarball(archive, {"lemma/1.json": '{"word":"fisk"}'})

        target = tmp_path / "out"
        target.mkdir()
        safe_extract_tarball(archive, target)

        assert (target / "lemma" / "1.json").read_text() == '{"word":"fisk"}'

    def test_rejects_path_traversal(self, tmp_path: Path) -> None:
        archive = tmp_path / "evil.tar.gz"
        self._create_tarball(archive, {"../../etc/passwd": "hacked"})

        target = tmp_path / "out"
        target.mkdir()

        with pytest.raises(ValueError, match="Unsafe tar member path"):
            safe_extract_tarball(archive, target)


class TestFindLemmaDirectory:
    def test_returns_lemma_subdir(self, tmp_path: Path) -> None:
        lemma_dir = tmp_path / "lemma"
        lemma_dir.mkdir()
        (lemma_dir / "1.json").write_text("{}")
        assert find_lemma_directory(tmp_path) == lemma_dir

    def test_returns_root_dir_with_json_files(self, tmp_path: Path) -> None:
        (tmp_path / "1.json").write_text("{}")
        assert find_lemma_directory(tmp_path) == tmp_path

    def test_fallback_to_json_parent(self, tmp_path: Path) -> None:
        nested = tmp_path / "sub" / "dir"
        nested.mkdir(parents=True)
        (nested / "1.json").write_text("{}")
        assert find_lemma_directory(tmp_path) == nested

    def test_raises_when_no_json(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="No lemma JSON directory found"):
            find_lemma_directory(tmp_path)

    def test_fallback_picks_by_filename_not_path(self, tmp_path: Path) -> None:
        dir_a = tmp_path / "aaa"
        dir_a.mkdir()
        (dir_a / "900.json").write_text("{}")

        dir_b = tmp_path / "zzz"
        dir_b.mkdir()
        (dir_b / "1.json").write_text("{}")

        result = find_lemma_directory(tmp_path)
        assert result == dir_b

    def test_ignores_non_numeric_json_at_root(self, tmp_path: Path) -> None:
        (tmp_path / "package.json").write_text("{}")
        nested = tmp_path / "sub"
        nested.mkdir()
        (nested / "1.json").write_text("{}")

        assert find_lemma_directory(tmp_path) == nested

    def test_raises_when_only_non_numeric_json(self, tmp_path: Path) -> None:
        (tmp_path / "package.json").write_text("{}")
        (tmp_path / "metadata.json").write_text("{}")

        with pytest.raises(ValueError, match="No lemma JSON directory found"):
            find_lemma_directory(tmp_path)


class TestResolveDataDir:
    def test_local_directory(self, tmp_path: Path) -> None:
        (tmp_path / "1.json").write_text("{}")
        with resolve_data_dir(str(tmp_path)) as data_dir:
            assert data_dir == tmp_path

    def test_local_tarball(self, tmp_path: Path) -> None:
        import io

        lemma_dir = tmp_path / "src" / "lemma"
        lemma_dir.mkdir(parents=True)
        (lemma_dir / "1.json").write_text('{"word":"fisk"}')

        archive_path = tmp_path / "data.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            content = b'{"word":"fisk"}'
            info = tarfile.TarInfo(name="lemma/1.json")
            info.size = len(content)
            tar.addfile(info, io.BytesIO(content))

        with resolve_data_dir(str(archive_path)) as data_dir:
            assert (data_dir / "1.json").exists()

    def test_invalid_source_raises(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="Source must be"):
            with resolve_data_dir(str(tmp_path / "nonexistent.tar.gz")):
                pass
