#include <memory>

class CheckFileInfo
{
};

class SocketPoll
{
};

class D : public SocketPoll
{
};

int main() {
    {
        // expected-error@+1 {{instance allocated on the stack, create it with std::shared_ptr [coplugin:refcounting]}}
        CheckFileInfo checkFileInfo;
    }

    {
        // good
        auto checkFileInfo = std::make_shared<CheckFileInfo>();
    }

    {
        // expected-error@+1 {{instance allocated on the stack, create it with std::shared_ptr [coplugin:refcounting]}}
        D d;
    }

    {
        // good
        auto d = std::make_shared<D>();
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
