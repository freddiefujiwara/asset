import AssetSpec.Spec
import Lean.Data.Json.Basic
import Lean.Data.Json.Parser

open Lean (Json)
open AssetSpec

/-- Extract an integer field; anything else (absent, null, string)
    counts as 0, matching the harness contract. -/
def getInt (j : Json) (k : String) : Int :=
  match j.getObjVal? k with
  | .ok v => (match v.getInt? with | .ok n => n | _ => 0)
  | _ => 0

def getBool (j : Json) (k : String) : Bool :=
  match j.getObjVal? k with
  | .ok (.bool b) => b
  | _ => false

def rowFromJson (j : Json) : Row :=
  { eval := getInt j "eval"
    cur := getInt j "cur"
    bal := getInt j "bal"
    profit := getInt j "profit"
    hasProfit := getBool j "hasProfit" }

def rowsFromJson (j : Json) (k : String) : List Row :=
  match j.getObjVal? k with
  | .ok (.arr a) => a.toList.map rowFromJson
  | _ => []

def handle (j : Json) : String :=
  let stocks := rowsFromJson j "stocks"
  let funds := rowsFromJson j "funds"
  let pensions := rowsFromJson j "pensions"
  let crypto := rowsFromJson j "crypto"
  let total := riskTotal stocks funds pensions crypto
  let profit := profitTotal stocks funds pensions
  s!"\{\"totalYen\":{total},\"totalProfitYen\":{profit}}"

partial def loop (stdin stdout : IO.FS.Stream) : IO Unit := do
  let line ← stdin.getLine
  if line.isEmpty then return ()
  let resp := match Json.parse line.trim with
    | .ok j => handle j
    | .error e => s!"\{\"error\":\"parse: {e}\"}"
  stdout.putStrLn resp
  stdout.flush
  loop stdin stdout

def main : IO Unit := do
  let stdin ← IO.getStdin
  let stdout ← IO.getStdout
  loop stdin stdout
