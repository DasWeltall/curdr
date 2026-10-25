"""Build the static product website. GitHub distributes the agent guide and release source."""
from pathlib import Path
import argparse,shutil
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=root/'artifacts/website');args=parser.parse_args()
out=args.out.resolve();shutil.copytree(root/'website',out,dirs_exist_ok=True)
# Retain a local copy for humans; the canonical agent URL is GitHub Raw.
shutil.copyfile(root/'install.md',out/'install.md')
skill=out/'skills/curdr-install';skill.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/'skills/curdr-install/SKILL.md',skill/'SKILL.md')
print(out)
