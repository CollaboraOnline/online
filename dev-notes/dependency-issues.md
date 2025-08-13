## Poco issues

Known poco issues are:

+ In Poco < 1.13.2 there is a known issue that Poco::BasicMemoryStreamBuf
  doesn't implement seekpos, so calling using the single argument variant of
  seekg on a MemoryStream fails, this can be worked around by using the double
  argument variant of seekg which uses Poco::BasicMemoryStreamBuf seekoff
  which is implemented.
  See: https://github.com/pocoproject/poco/issues/4492

+ In Poco 1.13.0 there is a known bug that Poco crashes on start up with:

  Failed to initialize COOLWSD: Null pointer: strategy in file "./Foundation/src/FileChannel.cpp", line 283

  due to the use of rotation, never in coolwsd.xml for log rotation strategy.
  This can be worked around by changing "never" in "monthly" in coolwsd.xml.
  See: https://github.com/pocoproject/poco/issues/4411
