# my-project

---

project features:
 - eslint
 - prettier
 - typescript
 - jest
 - esbuild
 - husky v4
 - lint-staged

npm scripts:
 - run tests
 - format all w/ prettier
 - lint all
 - lint and fix all
 - build (dev)
 - build & run (dev)
 
git hooks:
 - pre-commit:
   - *.json - format
   - *.ts,*.js - format and lint
