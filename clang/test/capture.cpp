#include <functional>

class C
{
  public:
    std::function<void()> f;
    // expected-error@+1 {{function parameter captured by reference, capture by value instead [coplugin:capture]}}
    C(unsigned id) : f([&]() { (void)id; }) {}
};

class D
{
  public:
    std::function<void()> f;
    // good
    D(unsigned id) : f([id]() { (void)id; }) {}
};

void f1()
{
    auto l1 = [](unsigned id) {
        // expected-error@+1 {{function parameter captured by reference, capture by value instead [coplugin:capture]}}
        auto l2 = [&id]() {};
    };
}

void f2()
{
    auto l1 = [](unsigned id) {
        // good
        auto l2 = [id]() {};
    };
}

int main() { C c(0); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
