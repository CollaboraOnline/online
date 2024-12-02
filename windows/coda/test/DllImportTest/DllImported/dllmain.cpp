typedef void (*callback1)(int a, const char *s1, const char *s2, int s2len);

static callback1 callback1_function;

extern "C" __declspec(dllexport)
void set_callback_1(callback1 f)
{
  callback1_function = f;
}

extern "C" __declspec(dllexport)
void dllimport_function_1(int a, const char *s)
{
  callback1_function(a + 1, s, "Zero:\0:There", 12);
}

