/*
 * Copyright (C) 2018 Aleksandr Seleznev <alex@slznv.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 */

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const Soup = imports.gi.Soup;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

const Gettext = imports.gettext.domain('gnome-shell-extensions-prometheus-notifier');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Settings = Convenience.getSettings();

const HttpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(HttpSession, new Soup.ProxyResolverDefault());

const PrometheusNotifierMenu = new Lang.Class({
    Name: 'PrometheusNotifierMenu.PrometheusNotifierMenu',
    Extends: PanelMenu.Button,

    _notifications: {},

    _init: function() {
        this.parent(0.0, _("Prometheus Notifier"));

        // Button (indicator)
        let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        this.icon = new St.Icon({ icon_name: 'dialog-warning-symbolic',
                                  style_class: 'system-status-icon' });
        this.label = new St.Label({ text: '~',
                                    y_expand: true,
                                    y_align: Clutter.ActorAlign.CENTER });

        hbox.add_child(this.icon);
        hbox.add_child(this.label);
        hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));

        this.actor.add_child(hbox);

        // Menu
        this.menu.addAction(_("Alertmanager"), function(event) {
            let base_url = Settings.get_string('url') || ''; // TODO: need better default value
            let filter = Settings.get_string('label-filter').replace(/"/g, '\\"') || ''
            let receiver_regex = Settings.get_string('receiver-filter') || ''
            let alertmanager_url = base_url + '/#/alerts?silenced=false&inhibited=false&unprocessed=false&filter=' + filter + '&receiver=' + encodeURI(receiver_regex);

            GLib.spawn_command_line_async('xdg-open ' + alertmanager_url);
        });
        //this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // First update
        this._checkAlerts();
    },

    destroy: function() {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);

        this.parent();
    },

    _checkAlerts: function() {
        let base_url = Settings.get_string('url') || ''; // TODO: need better default value
        let filter = Settings.get_string('label-filter') || ''
        let receiver_regex = Settings.get_string('receiver-filter') || ''
        let api_url = base_url + '/api/v1/alerts?silenced=false&inhibited=false&unprocessed=false&filter=' + filter + '&receiver=' + encodeURI(receiver_regex);

        this._httpGetRequestAsync(api_url, function(json) {
            let last_update = new Date((Settings.get_int('last-update') || 0) * 1000);

            // TODO: check result status of request

            let alerts_count = 0;
            let alerts_new

            for (var i = 0; i < json['data'].length; i++) {
                let alert = json['data'][i];

                alert['startsAt'] = new Date(alert['startsAt']); // Convert to date object

                // Send notifications for new alerts
                if (alert['startsAt'].getTime() > last_update.getTime()) {
                    let url = alert['generatorURL'];
                    let urgency = MessageTray.Urgency.HIGH;
                    let title = _("[%s] %s").format(alert['labels']['alertname'],
                                                    alert['annotations']['summary']);
                    let summary = alert['annotations']['description'];

                    this._sendNotification(title, summary, 'dialog-warning', urgency, url);
                }

                alerts_count++;
            }

            let new_last_update = new Date();
            Settings.set_int('last-update', new_last_update.getTime()/1000);

            this._updateButton(alerts_count);
        });

        // Next update
        let update_interval = Settings.get_int('update-interval') || 60;
        this._timeout = Mainloop.timeout_add_seconds(update_interval, Lang.bind(this, this._checkAlerts));
    },

    _sendNotification: function(title, summary, icon='dialog-warning', urgency=MessageTray.Urgency.HIGH, url=null) {
        let source = new MessageTray.Source(_("Prometheus Notifier"), icon);
        source.url = url;

        let notification = new MessageTray.Notification(source, title, summary);
        notification.setUrgency(urgency);
        if (url) {
            notification.connect('activated', function() {
                GLib.spawn_command_line_async('xdg-open ' + source.url);
            });
        }
        Main.messageTray.add(source);

        source.notify(notification);
        return notification;
    },

    _formatText: function(text, count=100) {
        let short = text.substr(0, count);
        if (/^\S/.test(text.substr(count)))
            return short.replace(/\s+\S*$/, "...");
        return short;
    },

    _updateButton: function(alerts_count) {
        // Prepare label
        let text = alerts_count.toString();

        this.label.set_text(text);

        // Burn bulb :)
        //(important > 0) ? this.icon.show() : this.icon.hide();
    },

    _httpGetRequestAsync: function(url, callback) {
        let here = this;

        let message = Soup.Message.new('GET', url);
        HttpSession.queue_message(message, function(session, message) {
            let jp = JSON.parse(message.response_body.data);
            callback.call(here, jp);
        });
    },
});

function init() {
}

let indicator;

function enable() {
    indicator = new PrometheusNotifierMenu;
    Main.panel.addToStatusArea('prometheus-notifier', indicator);
}

function disable() {
    indicator.destroy();
}
