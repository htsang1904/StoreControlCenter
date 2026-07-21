from fastapi import FastAPI

from app.api.api import api_router
from app.api.routers.admin_qc import _validate_scoring_payload
from fastapi import HTTPException
import pytest


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
    form_params = {
        item["name"]
        for item in spec["paths"]["/qc/forms/{id}"]["get"]["parameters"]
    }

    assert {"page", "page_size", "pageSize", "status", "store_id", "q", "date_from", "date_to", "template_id"} <= sessions_params
    assert {"page", "page_size", "pageSize", "sort_by", "sortBy", "sort_dir", "sortDir"} <= stores_params
    assert "formVersionId" in form_params


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

def test_admin_qc_version_routes_are_explicit():
    app = _build_app()
    spec = app.openapi()
    paths = spec["paths"]

    assert "get" in paths["/admin/qc/forms/{form_id}/versions"]
    assert "post" in paths["/admin/qc/forms/{form_id}/versions"]
    assert "get" in paths["/admin/qc/forms/{form_id}/versions/{version_id}"]
    assert "put" in paths["/admin/qc/forms/{form_id}/versions/{version_id}"]
    assert "delete" in paths["/admin/qc/forms/{form_id}/versions/{version_id}"]
    assert "post" in paths["/admin/qc/forms/{form_id}/versions/{version_id}/apply"]

def test_qc_scoring_v2_payload_accepts_all_supported_modes():
    _validate_scoring_payload({
        "passThreshold": 80,
        "criteria": [{
            "nodeType": "group",
            "name": "Vận hành",
            "children": [
                {"nodeType": "criterion", "name": "Điểm", "mode": "point", "maxScore": 10},
                {"nodeType": "criterion", "name": "Đạt", "mode": "pass_fail", "maxScore": 5},
                {"nodeType": "criterion", "name": "Trừ", "mode": "deduction", "deductionPercent": 2.5},
            ],
        }],
    })

def test_qc_scoring_v2_payload_rejects_deduction_only_form():
    with pytest.raises(HTTPException) as exc_info:
        _validate_scoring_payload({
            "passThreshold": 80,
            "criteria": [{"nodeType": "criterion", "name": "Trừ", "mode": "deduction", "deductionPercent": 5}],
        })

    assert exc_info.value.status_code == 400
