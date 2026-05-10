import ipaddress
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class IpLocationResult:
    latitude: float
    longitude: float
    city: str
    state: str
    source: str


def _is_public_ip(ip: Optional[str]) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
        return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved)
    except ValueError:
        return False


def _ipapi_co(ip: Optional[str]) -> tuple[Optional[IpLocationResult], str]:
    url = f"https://ipapi.co/{ip}/json/" if ip else "https://ipapi.co/json/"
    try:
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            r = client.get(url, headers={"User-Agent": "weather-risk-dashboard/1.0"})
            if r.status_code != 200:
                return None, f"ipapi.co HTTP {r.status_code}: {r.text[:200]}"
            d = r.json()
            if d.get("error"):
                return None, f"ipapi.co error: {d.get('reason') or d}"
            lat = d.get("latitude")
            lon = d.get("longitude")
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                return None, f"ipapi.co payload inválido: {d}"
            return IpLocationResult(
                latitude=float(lat),
                longitude=float(lon),
                city=str(d.get("city") or ""),
                state=str(d.get("region_code") or d.get("region") or ""),
                source="ipapi.co",
            ), ""
    except httpx.TimeoutException:
        return None, "ipapi.co timeout (8s)"
    except httpx.RequestError as e:
        return None, f"ipapi.co rede: {type(e).__name__}: {e}"
    except Exception as e:
        return None, f"ipapi.co erro: {type(e).__name__}: {e}"


def _freeipapi(ip: Optional[str]) -> tuple[Optional[IpLocationResult], str]:
    url = f"https://freeipapi.com/api/json/{ip}" if ip else "https://freeipapi.com/api/json"
    try:
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            r = client.get(url)
            if r.status_code != 200:
                return None, f"freeipapi.com HTTP {r.status_code}: {r.text[:200]}"
            d = r.json()
            lat = d.get("latitude")
            lon = d.get("longitude")
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                return None, f"freeipapi.com payload inválido: {d}"
            return IpLocationResult(
                latitude=float(lat),
                longitude=float(lon),
                city=str(d.get("cityName") or ""),
                state=str(d.get("regionName") or ""),
                source="freeipapi.com",
            ), ""
    except httpx.TimeoutException:
        return None, "freeipapi.com timeout (8s)"
    except httpx.RequestError as e:
        return None, f"freeipapi.com rede: {type(e).__name__}: {e}"
    except Exception as e:
        return None, f"freeipapi.com erro: {type(e).__name__}: {e}"


class GetIpLocationUseCase:
    """Resolves user location by IP from server side.

    Bypasses browser CORS by calling IP geolocation APIs directly from the backend
    (httpx). Used as last-resort fallback when the Next.js proxy chain also fails.
    """

    def execute(self, client_ip: Optional[str]) -> IpLocationResult:
        ip = client_ip if _is_public_ip(client_ip) else None
        logger.info("[ip-locate] client_ip=%r usando_ip=%r", client_ip, ip)

        errors: list[str] = []
        for name, fn in (("ipapi.co", _ipapi_co), ("freeipapi.com", _freeipapi)):
            result, err = fn(ip)
            if result is not None:
                logger.info("[ip-locate] sucesso via %s: city=%r state=%r", name, result.city, result.state)
                return result
            logger.warning("[ip-locate] %s falhou: %s", name, err)
            errors.append(err)

        raise RuntimeError("Todas as APIs falharam: " + " | ".join(errors))
