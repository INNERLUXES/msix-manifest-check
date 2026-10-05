# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

Several checks of a package manifest tempt a tool to look at the calendar: a MinVersion that names a build Microsoft
no longer services, a certificate that is about to expire, a Windows release that is old. Each of these would make the
same files give a different result on a different day, so a pipeline that passed yesterday could fail today with no
change to the repository, and two people reading the same commit could see two reports. The output could never be
saved and compared.

The checks do not need a date. Whether the publisher is the subject of the certificate, whether the version has four
parts, whether MinVersion is below MaxVersionTested: all of it can be read from the files as they are. Even the build
floor is a number. Windows releases are named by marketing names that hold a number reading like a year, and the build
number (the third part of a quad version such as 10.0.19041.0) says the same thing with no date in it.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time. The same files and
   configuration give the same output on every machine and on every day.
2. The lowest build a manifest should target is `minBuildFloor`, a quad version in the configuration (10.0.17763.0 by
   default). It is never worked out from the date; docs/inputs.md says how the default was chosen and asks the team to
   check Microsoft's release information page and set it.
3. No file of this repository holds a date or a number that reads like a year: not the licence, not the changelog, not
   the documents, not the comments of the code, not the tests, not the examples. `npm run check` and a test fail on any
   word of four digits that starts with 19 or 20. Windows releases are written by build number only.
4. A build number is not a year and is not caught: 10.0.19041.0 holds the word 19041, five digits, and the pattern asks
   for a word of exactly four. A test of test/repo.test.js runs the pattern over the builds of the examples and of the
   documents and checks that none of them is caught, and that a year in the same place still is; the pattern is the
   same in the tests and in tools/check.mjs. No exception is needed, so there is none.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it does
  not move with the calendar.
- A build that falls out of servicing is not reported until the team raises `minBuildFloor`; docs/limits.md says so.
- The values of the examples are chosen so that no version, size, color or count reads like a year, and a check catches
  one that does.
