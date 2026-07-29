import pytest
from fastapi import HTTPException

from app.services.privacy_service import add_laplace_noise
from app.routers.privacy import delete_account, AccountDeletionRequest


def test_add_laplace_noise_returns_float():
    result = add_laplace_noise(10.0)
    assert isinstance(result, float)


def test_add_laplace_noise_not_always_equal_to_input():
    value = 10.0
    results = [add_laplace_noise(value) for _ in range(50)]
    assert any(r != value for r in results)


def test_add_laplace_noise_statistically_reasonable_range():
    value = 0.0
    results = [add_laplace_noise(value, sensitivity=1.0, epsilon=1.0) for _ in range(500)]
    assert all(isinstance(r, float) for r in results)
    assert all(abs(r) < 50.0 for r in results)
    mean_abs = sum(abs(r) for r in results) / len(results)
    assert mean_abs < 5.0


@pytest.mark.asyncio
async def test_delete_account_rejects_missing_confirm():
    request = AccountDeletionRequest(confirm=False)
    current_user = {"id": "user-1"}

    with pytest.raises(HTTPException) as exc_info:
        await delete_account(req=request, current_user=current_user)

    assert exc_info.value.status_code == 400