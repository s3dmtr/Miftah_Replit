#!/usr/bin/env bash
# End-to-end API smoke test. Run against a freshly seeded DB: npm run seed && npm start, then npm run test:api
set -u
API=${API:-http://localhost:4000/api}
PASS=0; FAIL=0
check() { # name expected actual
  if [ "$2" == "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1"; else FAIL=$((FAIL+1)); echo "FAIL  $1 (expected $2, got $3)"; fi
}
req() { # method path token body -> prints "status|body"
  local out; out=$(curl -s -w '\n%{http_code}' -X "$1" "$API$2" -H 'Content-Type: application/json' ${3:+-H "Authorization: Bearer $3"} ${4:+-d "$4"})
  BODY=$(echo "$out" | sed '$d'); CODE=$(echo "$out" | tail -n1)
}
login() { req POST /auth/login "" "{\"email\":\"$1\",\"password\":\"miftah123\"}"; echo "$BODY" | jq -r .token; }

req GET /health; check "health" 200 "$CODE"

# --- auth
req POST /auth/login "" '{"email":"seeker@miftah.demo","password":"wrong"}'; check "login rejects bad password" 401 "$CODE"
SEEKER=$(login seeker@miftah.demo); COMPANY=$(login company@miftah.demo); SUPER=$(login supervisor@miftah.demo); ADMIN=$(login admin@miftah.demo); C2=$(login c2@miftah.demo)
[ "$SEEKER" != "null" ]; check "login returns JWT" 0 $?
req GET /auth/me "$COMPANY"; check "me" 200 "$CODE"; check "me role" company "$(echo "$BODY" | jq -r .user.role)"
EMAIL="new$(date +%s)@example.com"
req POST /auth/register "" "{\"name\":\"Test Office\",\"email\":\"$EMAIL\",\"password\":\"password123\",\"role\":\"company\"}"; check "register validates licence/CR" 400 "$CODE"
req POST /auth/register "" "{\"name\":\"Test Office\",\"email\":\"$EMAIL\",\"password\":\"password123\",\"role\":\"company\",\"license\":\"FAL-1\",\"crNumber\":\"1010123456\"}"; check "register company" 201 "$CODE"
NEWCO=$(echo "$BODY" | jq -r .token)
req POST /listings "$NEWCO" '{"type":"villa","deal":"sale","price":3000000,"districtId":"malqa","area":400}'; check "unverified advertiser cannot publish" 403 "$CODE"

# --- search & details
req GET "/properties"; check "search" 200 "$CODE"; TOTAL=$(echo "$BODY" | jq .total)
req GET "/properties?deal=sale&type=villa&district=malqa&maxPrice=5000000&sort=price_asc"; check "search with filters" 200 "$CODE"
check "filters applied" true "$(echo "$BODY" | jq '[.results[] | .property.type=="villa" and .property.districtId=="malqa" and .best.price<=5000000] | all')"
req GET "/properties?type=castle"; check "search validation" 400 "$CODE"
req GET /properties/p1; check "property details" 200 "$CODE"; check "p1 has 3 grouped offers" 3 "$(echo "$BODY" | jq '.offers|length')"
req GET /properties/nope; check "property 404" 404 "$CODE"
req POST /listings/l1/view; check "record view" 200 "$CODE"

# --- land code + duplicate prevention (company c1 already lists p1 = DEMO-RYD-10001)
req GET /land-codes/DEMO-RYD-10001 "$COMPANY"; check "land lookup" 200 "$CODE"; check "lookup flags own live ad" true "$(echo "$BODY" | jq '.yourExistingListingId != null')"
req POST /listings "$COMPANY" '{"landCode":"DEMO-RYD-10001","type":"villa","deal":"sale","price":3900000}'; check "duplicate rejected (same account, same land code)" 409 "$CODE"; check "duplicate error code" duplicate "$(echo "$BODY" | jq -r .error)"
req POST /listings "$COMPANY" '{"landCode":"DEMO-RYD-99999","type":"villa","deal":"sale","price":3900000}'; check "unknown land code" 404 "$CODE"
# p3 (DEMO-RYD-10003) is listed by c2, m2, c3 but not c1 -> c1 joins the group
req POST /listings "$COMPANY" '{"landCode":"DEMO-RYD-10003","type":"apartment","deal":"sale","price":1100000,"images":["https://example.com/a.jpg"]}'; check "different account joins same property" 201 "$CODE"
check "joined existing property" true "$(echo "$BODY" | jq .joinedExisting)"; NEWL=$(echo "$BODY" | jq -r .listing.id)
req GET /properties/p3; check "p3 now has 4 offers" 4 "$(echo "$BODY" | jq '.offers|length')"
# DB-level guarantee: insert directly, bypassing the API
DBERR=$(PGPASSWORD=miftah psql -h localhost -U miftah -d miftah -tAc "INSERT INTO listings (property_id,advertiser_id,deal,price,title_ar,title_en,ad_license) VALUES ('p3','c1','sale',1,'x','x','x')" 2>&1 | grep -c listings_one_live_ad_per_land_code)
check "database unique index blocks duplicate" 1 "$DBERR"
req POST /listings "$COMPANY" '{"type":"shop","deal":"rent","price":90000,"districtId":"olaya","area":120}'; check "listing without land code (unidentified)" 201 "$CODE"

# --- listing management
req PATCH /listings/$NEWL "$COMPANY" '{"price":1090000}'; check "edit own listing" 200 "$CODE"; check "price updated" 1090000 "$(echo "$BODY" | jq .price)"
req PATCH /listings/$NEWL "$C2" '{"price":1}'; check "cannot edit someone else's listing" 403 "$CODE"
req PATCH /listings/$NEWL "$COMPANY" '{"status":"paused"}'; check "pause" 200 "$CODE"
req PATCH /listings/$NEWL "$COMPANY" '{"status":"active"}'; check "resume" 200 "$CODE"
req POST /listings/$NEWL/images "$COMPANY" '{"urls":["https://example.com/b.jpg"]}'; check "add images" 201 "$CODE"; check "2 images" 2 "$(echo "$BODY" | jq '.images|length')"
req GET /dashboard "$COMPANY"; check "advertiser dashboard" 200 "$CODE"
req GET /dashboard "$SEEKER"; check "dashboard requires advertiser role" 403 "$CODE"

# --- inquiries
req POST /listings/l2/inquiries "$SEEKER" '{"message":"Is it available? you idiot"}'; check "open inquiry" 201 "$CODE"; CONV=$(echo "$BODY" | jq -r .id)
check "bad word flagged" true "$(echo "$BODY" | jq '.messages[-1].flagged')"
req POST /conversations/$CONV/messages "$C2" '{"text":"Yes, viewing Thursday."}'; check "advertiser replies" 201 "$CODE"
req GET /conversations/$CONV "$COMPANY"; check "outsider cannot read conversation" 404 "$CODE"
req GET /conversations "$SEEKER"; check "list conversations" 200 "$CODE"

# --- favorites
req PUT /favorites/p5 "$SEEKER"; check "add favorite" 204 "$CODE"
req GET /favorites "$SEEKER"; check "favorite saved" true "$(echo "$BODY" | jq 'index("p5") != null')"

# --- status sync: company marks its p3 ad sold -> supervisor verifies -> all p3 ads close
req POST /listings/$NEWL/status-requests "$COMPANY" '{"value":1080000}'; check "status request" 201 "$CODE"; SR=$(echo "$BODY" | jq -r .id)
req GET /properties/p3; check "other offers unchanged before verification" 3 "$(echo "$BODY" | jq '.offers|length')"
req POST /admin/status-requests/$SR/approve "$SEEKER"; check "seeker cannot approve" 403 "$CODE"
req POST /admin/status-requests/$SR/approve "$SUPER"; check "supervisor approves" 200 "$CODE"; check "all 4 p3 ads closed" 4 "$(echo "$BODY" | jq .closedListings)"
req GET /properties/p3; check "property now sold" sold "$(echo "$BODY" | jq -r .property.availability)"
check "every offer closed" true "$(echo "$BODY" | jq '[.offers[] | .status=="closed" and .closedReason=="sold"] | all')"
req POST /admin/status-requests/$SR/approve "$SUPER"; check "cannot approve twice" 409 "$CODE"
req GET "/properties?deal=sale"; check "sold property hidden from search" false "$(echo "$BODY" | jq '[.results[].property.id] | index("p3") != null')"

# --- AI agent (database-backed)
agent() { req POST /agent/chat "" "$1"; }
req GET /agent/status; check "agent status" 200 "$CODE"
check "agent reports missing key when unset" "$([ -n "${OPENAI_API_KEY:-}" ] && echo 0 || echo 1)" "$(echo "$BODY" | jq '[.missingConfig[] | select(.=="OPENAI_API_KEY")] | length')"
agent '{"message":"ابي فيلا في الملقا"}'; check "agent asks follow-up (deal missing)" 0 "$(echo "$BODY" | jq '.reply.matches|length')"
P=$(echo "$BODY" | jq -c .reply.prefs)
agent "{\"message\":\"للبيع بحدود ٤ مليون قريبة من مسجد\",\"prefs\":$P}"; check "agent multi-turn returns DB matches" true "$(echo "$BODY" | jq '.reply.matches|length > 0')"
check "agent data source" postgresql "$(echo "$BODY" | jq -r .meta.dataSource)"
check "top match is the Malqa villa in DB" p1 "$(echo "$BODY" | jq -r '.reply.matches[0].property.id')"
check "matches respect budget (+10%)" true "$(echo "$BODY" | jq '[.reply.matches[].listing.price <= 4400000] | all')"
agent '{"message":"ابي شقه للايجار بالنرجس ٣ غرف حدود ٧٠ الف"}'; check "Arabic no-hamza rent parsed" rent "$(echo "$BODY" | jq -r .reply.prefs.deal)"
check "Arabic district with prefix parsed" narjis "$(echo "$BODY" | jq -r '.reply.prefs.districts[0]')"
agent '{"message":"فلة للبيع بحطين بمليون ونص قريبة من جامعة"}'; check "spoken budget 1.5M" 1500000 "$(echo "$BODY" | jq .reply.prefs.budgetMax)"
check "university not read as mosque" '["university"]' "$(echo "$BODY" | jq -c .reply.prefs.amenities)"
agent '{"message":"Office for rent in Al Olaya under 200K"}'; check "English query matches offices" true "$(echo "$BODY" | jq '[.reply.matches[].property.type=="office"] | all and length>0')"
agent '{"message":""}'; check "agent validates input" 400 "$CODE"

# --- admin
req GET /admin/duplicates "$ADMIN"; check "duplicate attempts logged" true "$(echo "$BODY" | jq 'length >= 1')"
req GET /admin/transactions "$ADMIN"; check "demo commission recorded" true "$(echo "$BODY" | jq 'length >= 1')"
req GET /admin/advertisers?verified=pending "$ADMIN"; check "pending advertisers" 200 "$CODE"
req GET /admin/users "$SUPER"; check "users list is admin-only" 403 "$CODE"
req GET /state "$ADMIN"; check "state snapshot" 200 "$CODE"
req GET /nope; check "unknown route 404" 404 "$CODE"

echo "------"; echo "passed: $PASS  failed: $FAIL  (search total before changes: $TOTAL)"
[ "$FAIL" -eq 0 ]
