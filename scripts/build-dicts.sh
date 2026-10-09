#!/bin/zsh
# Rebuilds public/dict: the 50,000 most common words of each language (FrequencyWords, counted in film
# subtitles) with their meanings from English Wiktionary (kaikki.org's extract: 8 GB, but about 700 MB as sent
# compressed, streamed and never saved whole). Both are CC BY-SA 4.0, and so are the files made from them.
#   scripts/build-dicts.sh          all twelve, three downloads at a time
#   scripts/build-dicts.sh de fr    some
# KEEP=<folder> keeps each word list and a small copy of the entries read, to rebuild after a rule change
# without downloading again: gunzip -c <folder>/de.jsonl.gz | node scripts/build-dict.mjs de <folder>/de.freq public/dict/de.json.gz
setopt pipefail
zmodload zsh/parameter
cd "${0:A:h}/.."
typeset -A KAIKKI=(de German es Spanish fr French it Italian pt Portuguese nl Dutch sv Swedish pl Polish ru Russian ja Japanese zh Chinese tr Turkish)
# FrequencyWords has no 50k list for Japanese, and files Chinese under zh_cn.
typeset -A FREQ=(ja ja/ja_full.txt zh zh_cn/zh_cn_50k.txt)
dir=${KEEP:-$(mktemp -d)}
mkdir -p $dir public/dict

one() {
  local code=$1 name=${KAIKKI[$1]}
  [[ -n $name ]] || { echo "$code: no such language"; return 1; }
  curl -sfL --retry 3 -o $dir/$code.freq "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${FREQ[$code]:-$code/${code}_50k.txt}" ||
    { echo "$code: the word list didn't download"; return 1; }
  # Written beside the old file, and moved over it only when the whole extract came through.
  if curl --compressed -sfL "https://kaikki.org/dictionary/$name/kaikki.org-dictionary-$name.jsonl" |
    node scripts/build-dict.mjs $code $dir/$code.freq public/dict/$code.json.gz.new ${KEEP:+$dir/$code.jsonl.gz}; then
    mv public/dict/$code.json.gz.new public/dict/$code.json.gz
  else
    rm -f public/dict/$code.json.gz.new
    echo "$code: failed, the old file is kept"
  fi
}

# Largest download first, so the last ones to finish are small.
codes=($@)
(( $#codes )) || codes=(zh de es ru pl it fr pt tr ja sv nl)
for code in $codes; do
  while (( ${#jobstates} >= 3 )); do sleep 1; done
  one $code &
done
wait
[[ -n $KEEP ]] || { rm -f -- $dir/*.freq(N) && rmdir -- $dir; }
