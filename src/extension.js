/*
 * Copyright (C) 2018-2025 Aleksandr Seleznev <alex@slznv.net>
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

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Soup from 'gi://Soup';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const HttpSession = new Soup.Session();

let PrometheusNotifierMenuClass = GObject.registerClass({
        GTypeName: "PrometheusNotifierMenu"
    },
    class PrometheusNotifierMenu extends PanelMenu.Button {
        constructor(settings) {
            super(0.0, _("Prometheus Notifier"));

            this._settings = settings;
            this._notifications = {};

            // Button (indicator)
            this.box = new St.BoxLayout({
                style_class: 'panel-status-menu-box'
            });
            this.add_child(this.box);

            this.icon = new St.Icon({
                icon_name: 'content-loading-symbolic',
                style_class: 'system-status-icon'
            });
            this.box.add_child(this.icon);

            this.label = new St.Label({
                text: '?',
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            this.label.hide();
            this.box.add_child(this.label);

            // First update.
            this._checkAlerts();
        }

        destroy() {
            if (this._timeout)
                GLib.source_remove(this._timeout);

            this._notifications = null;
            this._settings = null;

            super.destroy();
        }

        vfunc_event(event) {
            if (event.type() === Clutter.EventType.TOUCH_END ||
                event.type() === Clutter.EventType.BUTTON_RELEASE) {
                this._openAlertmanager();
            }

            return Main.wm.handleWorkspaceScroll(event);
        }

        vfunc_key_release_event(event) {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_space) {
                this._openAlertmanager();

                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        }

        _openAlertmanager() {
            let base_url = this._settings.get_string('url') || '';
            if (base_url === '') {
                // Base URL is not configured - skipping.
                return;
            }

            let label_filter = this._settings.get_string('label-filter') || '';
            let receiver_filter = this._settings.get_string('receiver-filter') || '';
            let web_url = base_url + '/#/alerts?silenced=false&inhibited=false&muted=false&active=true';

            if (label_filter !== '') {
                web_url += '&filter=' + encodeURIComponent('{' + label_filter + '}');
            }

            if (receiver_filter !== '') {
                web_url += '&receiver=' + encodeURIComponent(receiver_filter);
            }

            GLib.spawn_command_line_async('xdg-open ' + web_url);
        }

        _checkAlerts() {
            let base_url = this._settings.get_string('url') || '';
            if (base_url === '') {
                // Base URL is not configured - skipping.
                return;
            }

            let label_filter = this._settings.get_string('label-filter') || '';
            let receiver_filter = this._settings.get_string('receiver-filter') || '';
            let api_url = base_url + '/api/v2/alerts/groups?silenced=false&inhibited=false&muted=false&active=true';

            if (label_filter !== '') {
                api_url += '&filter=' + encodeURIComponent(label_filter);
            }

            if (receiver_filter !== '') {
                api_url += '&receiver=' + encodeURIComponent(receiver_filter);
            }

            this._httpGetRequestAsync(api_url, function(json) {
                let last_update = new Date((this._settings.get_int('last-update') || 0) * 1000);
                let alerts_count = 0;

                for (var i = 0; i < json.length; i++) {
                    let group = json[i];

                    for (var j = 0; j < group['alerts'].length; j++) {
                        let alert = group['alerts'][j];

                        alert['startsAt'] = new Date(alert['startsAt']); // convert to date object

                        // Send notifications for new alerts.
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
                }

                let new_last_update = new Date();
                this._settings.set_int('last-update', new_last_update.getTime()/1000);

                this._updateButton(alerts_count);
            });

            // Next update.
            let update_interval = this._settings.get_int('update-interval') || 60;
            this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, update_interval, this._checkAlerts.bind(this));
        }

        _httpGetRequestAsync(url, callback) {
            let here = this;

            const message = Soup.Message.new('GET', url);

            HttpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    if (message.get_status() === Soup.Status.OK) {
                        let bytes = session.send_and_read_finish(result);
                        let decoder = new TextDecoder('utf-8');
                        let response = decoder.decode(bytes.get_data());
                        let jp = JSON.parse(response);

                        callback.call(here, jp);
                    }
                }
            );
        }

        _sendNotification(title, summary, iconName, urgency=MessageTray.Urgency.HIGH, url=null) {
            let source = this._getNotificationSource();

            let notification = new MessageTray.Notification({
                source: source,
                title: title,
                body: summary,
                iconName: iconName,
                urgency: urgency,
            });

            if (url) {
                notification.connect('activated', function() {
                    GLib.spawn_command_line_async('xdg-open ' + url);
                });
            }

            source.addNotification(notification);

            return notification;
        }

        _getNotificationSource() {
            if (!this._notificationSource) {
                this._notificationSource = new MessageTray.Source({
                    title: _("Prometheus Notifier"),
                    iconName: 'dialog-warning',
                });

                this._notificationSource.connect('destroy', _source => {
                    this._notificationSource = null;
                });

                Main.messageTray.add(this._notificationSource);
            }

            return this._notificationSource;
        }

        _updateButton(alerts_count) {
            const warning_style_class = 'prometheus-notifier-button-warning';

            // Update counter.
            this.label.set_text(alerts_count.toString());

            // Burn bulb...
            if (alerts_count > 0) {
                this.icon.icon_name = 'dialog-warning-symbolic'; // or 'emblem-important-symbolic'?
                this.label.show();

                this.add_style_class_name(warning_style_class);
            } else {
                this.icon.icon_name = 'emblem-default-symbolic';
                this.label.hide();

                this.remove_style_class_name(warning_style_class);
            }
        }
    }
)

export default class PrometheusNotifierExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.PrometheusNotifierMenu = PrometheusNotifierMenuClass;
    }

    enable() {
        this._settings = this.getSettings();

        this._indicator = new this.PrometheusNotifierMenu(this._settings);
        if(this._indicator) {
            Main.panel.addToStatusArea('prometheus-notifier', this._indicator);
        }
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
