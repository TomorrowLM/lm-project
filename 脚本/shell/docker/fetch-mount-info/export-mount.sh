docker inspect --format='{{json .Mounts}}' nginx | awk '
BEGIN { RS=","; FS=":" }
{
  if ($0 ~ /"Source"/) {
    gsub(/"/, "", $2)
    gsub(/\[/, "", $2)
    gsub(/\]/, "", $2)
    source = $2
  }
  if ($0 ~ /"Destination"/) {
    gsub(/"/, "", $2)
    destination = $2
  }
  if (source && destination) {
    print "-v " source ":" destination
    source = ""
    destination = ""
  }
}'