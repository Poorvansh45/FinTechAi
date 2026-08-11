import json
import urllib.request


def test_endpoint(url):
    print(f"\nTesting endpoint: {url}")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            print(f"  Success: {data.get('success')}")
            print(f"  Count: {data.get('count')}")
            if data.get("data"):
                print(
                    f"  Sample Candidate: {data['data'][0]['symbol']} | {data['data'][0].get('company_name')}"
                )
            else:
                print("  No candidate data returned (empty list).")
    except Exception as e:
        print(f"  Error: {e}")


if __name__ == "__main__":
    test_endpoint("http://localhost:8000/api/scanner/launchpad?limit=3")
    test_endpoint("http://localhost:8000/api/scanner/alpha-zone?limit=3")
