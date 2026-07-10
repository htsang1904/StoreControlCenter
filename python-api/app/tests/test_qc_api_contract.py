from fastapi import FastAPI

from app.api.api import api_router


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(api_router)
    return app


def test_qc_drafts_crud_methods_are_exposed():
    app = _build_app()
    path_methods = {}

    for route in app.routes:
        path = getattr(route, "path", "")
        methods = set(getattr(route, "methods", set()) or set())
        if path.startswith("/qc/drafts"):
            path_methods.setdefault(path, set()).update(methods)

    assert "GET" in path_methods.get("/qc/drafts", set())
    assert "POST" in path_methods.get("/qc/drafts", set())
    assert "GET" in path_methods.get("/qc/drafts/{id}", set())
    assert "PUT" in path_methods.get("/qc/drafts/{id}", set())
    assert "DELETE" in path_methods.get("/qc/drafts/{id}", set())


def test_qc_overview_query_contract_contains_compat_params():
    app = _build_app()
    spec = app.openapi()

    sessions_params = {
        item["name"]
        for item in spec["paths"]["/qc/sessions/overview"]["get"]["parameters"]
    }
    stores_params = {
        item["name"]
        for item in spec["paths"]["/qc/stores/overview"]["get"]["parameters"]
    }

    assert {"page", "page_size", "pageSize", "status", "store_id", "q", "date_from", "date_to", "template_id"} <= sessions_params
    assert {"page", "page_size", "pageSize", "sort_by", "sortBy", "sort_dir", "sortDir"} <= stores_params


def test_qc_findings_uses_canonical_openapi_path_only():
    app = _build_app()
    spec = app.openapi()
    paths = set(spec["paths"].keys())

    assert "/qc/findings/" in paths
    assert "/qc/findings/{id}" in paths
    assert "/qc-findings/" not in paths
    assert "/qc-findings/{id}" not in paths


def test_openapi_operation_ids_are_unique():
    app = _build_app()
    spec = app.openapi()

    operation_ids = []
    for path_item in spec["paths"].values():
        for operation in path_item.values():
            operation_id = operation.get("operationId")
            if operation_id:
                operation_ids.append(operation_id)

    assert len(operation_ids) == len(set(operation_ids))
