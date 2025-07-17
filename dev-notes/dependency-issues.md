## Poco issues

Known poco issues are:

+ In Poco < 1.13.2 there is a known issue that Poco::BasicMemoryStreamBuf
  doesn't implement seekpos, so calling using the single argument variant of
  seekg on a MemoryStream fails, this can be worked around by using the double
  argument variant of seekg which uses Poco::BasicMemoryStreamBuf seekoff
  which is implemented.
  See: https://github.com/pocoproject/poco/issues/4492
