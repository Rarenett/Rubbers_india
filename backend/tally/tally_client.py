import requests
import logging
from django.conf import settings

logger = logging.getLogger('tally_sync')


def send_xml_to_tally(xml_data: str, tally_url: str = None) -> tuple[bool, str, str | None]:
    """
    Posts XML payload to Tally Prime's HTTP server endpoint.

    :param xml_data: Raw XML string to send
    :param tally_url: Optional override URL (defaults to http://{TALLY_ODBC_SERVER}:{TALLY_ODBC_PORT})
    :return: (success: bool, response_text: str, error_message: str|None)
    """
    if not tally_url:
        server = getattr(settings, 'TALLY_ODBC_SERVER', 'localhost')
        port = getattr(settings, 'TALLY_ODBC_PORT', '9000')
        tally_url = f"http://{server}:{port}"

    timeout = 15

    try:
        response = requests.post(
            tally_url,
            data=xml_data.encode('utf-8'),
            headers={'Content-Type': 'text/xml'},
            timeout=timeout
        )

        response_text = response.text or ""
        logger.debug(f"Tally response (HTTP {response.status_code}): {response_text[:300]}")

        import re
        created_match = re.search(r'<CREATED>(\d+)</CREATED>', response_text, re.IGNORECASE)
        altered_match = re.search(r'<ALTERED>(\d+)</ALTERED>', response_text, re.IGNORECASE)
        exceptions_match = re.search(r'<EXCEPTIONS>(\d+)</EXCEPTIONS>', response_text, re.IGNORECASE)

        created_cnt = int(created_match.group(1)) if created_match else 0
        altered_cnt = int(altered_match.group(1)) if altered_match else 0
        exceptions_cnt = int(exceptions_match.group(1)) if exceptions_match else 0

        is_success = (
             response.status_code == 200
             and (created_cnt > 0 or altered_cnt > 0)
             and 'LINEERROR' not in response_text.upper()
        )

        if is_success:
            return True, response_text, None

        # Fallback for vouchers created before 'b2f9bc40-8bb4-48b4-b2ac-0c6c858801dc-' prefix was added
        if 'b2f9bc40-8bb4-48b4-b2ac-0c6c858801dc-' in xml_data and 'ACTION="Alter"' in xml_data:
            fallback_xml = xml_data.replace('b2f9bc40-8bb4-48b4-b2ac-0c6c858801dc-', '')
            fb_response = requests.post(
                tally_url,
                data=fallback_xml.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=timeout
            )
            fb_text = fb_response.text or ""
            fb_created = int(re.search(r'<CREATED>(\d+)</CREATED>', fb_text, re.IGNORECASE).group(1)) if re.search(r'<CREATED>(\d+)</CREATED>', fb_text, re.IGNORECASE) else 0
            fb_altered = int(re.search(r'<ALTERED>(\d+)</ALTERED>', fb_text, re.IGNORECASE).group(1)) if re.search(r'<ALTERED>(\d+)</ALTERED>', fb_text, re.IGNORECASE) else 0
            fb_exceptions = int(re.search(r'<EXCEPTIONS>(\d+)</EXCEPTIONS>', fb_text, re.IGNORECASE).group(1)) if re.search(r'<EXCEPTIONS>(\d+)</EXCEPTIONS>', fb_text, re.IGNORECASE) else 0

            if fb_response.status_code == 200 and (fb_created > 0 or fb_altered > 0) and fb_exceptions == 0 and 'LINEERROR' not in fb_text.upper():
                return True, fb_text, None

        err_msg = f"Tally rejected XML. HTTP {response.status_code}."
        if 'LINEERROR' in response_text:
            err_msg += f" Details: {response_text[:500]}"
        elif response_text:
            err_msg += f" Response: {response_text[:300]}"
        return False, response_text, err_msg

    except requests.exceptions.ConnectionError as e:
        err_msg = f"Cannot connect to Tally server at {tally_url}. Is Tally running and HTTP server enabled?"
        logger.error(err_msg)
        return False, "", err_msg

    except requests.exceptions.Timeout as e:
        err_msg = f"Request to Tally server at {tally_url} timed out after {timeout} seconds."
        logger.error(err_msg)
        return False, "", err_msg

    except Exception as e:
        err_msg = f"Unexpected error while communicating with Tally: {str(e)}"
        logger.error(err_msg)
        return False, "", err_msg
