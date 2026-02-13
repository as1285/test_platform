from .base import PluginBase
from .websocket import WebSocketPlugin

plugins = {
    'websocket': WebSocketPlugin
}

def get_plugin(name):
    return plugins.get(name)
