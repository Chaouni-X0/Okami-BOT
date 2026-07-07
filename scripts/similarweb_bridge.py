import sys
import json
import os

# Add the runtime path for ApiClient
sys.path.append('/opt/.manus/.sandbox-runtime')
try:
    from data_api import ApiClient
except ImportError:
    # Fallback for local testing if needed
    class ApiClient:
        def call_api(self, *args, **kwargs):
            return {"error": "ApiClient not found in this environment"}

def get_stats(domain):
    client = ApiClient()
    try:
        # Get Global Rank
        rank = client.call_api('SimilarWeb/get_global_rank', path_params={'domain': domain})
        
        # Get Visits Total (Last 6 months)
        visits = client.call_api('SimilarWeb/get_visits_total', 
                               path_params={'domain': domain}, 
                               query={'country': 'world', 'granularity': 'monthly'})
        
        return {
            "domain": domain,
            "rank": rank,
            "visits": visits,
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "domain": domain, "status": "failed"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No domain provided"}))
        sys.exit(1)
    
    domain = sys.argv[1]
    stats = get_stats(domain)
    print(json.dumps(stats))
