// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getProfilesAndStatusesForPosts,
    receivedNewPost,
} from 'mattermost-redux/actions/posts';
import {
    getMissingProfilesByIds,
    getStatusesByIds,
} from 'mattermost-redux/actions/users';
import {UserTypes} from 'mattermost-redux/action_types';
import {General, WebsocketEvents} from 'mattermost-redux/constants';

import {handleNewPost} from 'actions/post_actions';
import {closeRightHandSide} from 'actions/views/rhs';
import {syncPostsInChannel} from 'actions/views/channel';

import store from 'stores/redux_store.jsx';

import configureStore from 'tests/test_store';

import Constants, {UserStatuses} from 'utils/constants';

import {
    handleNewPostEvent,
    handleNewPostEvents,
    handlePostEditEvent,
    handleUserRemovedEvent,
    handleUserTypingEvent,
    reconnect,
} from './websocket_actions';

jest.mock('mattermost-redux/actions/posts', () => ({
    ...jest.requireActual('mattermost-redux/actions/posts'),
    getProfilesAndStatusesForPosts: jest.fn(),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    getMissingProfilesByIds: jest.fn(() => ({type: 'GET_MISSING_PROFILES_BY_IDS'})),
    getStatusesByIds: jest.fn(() => ({type: 'GET_STATUSES_BY_IDS'})),
}));

jest.mock('actions/post_actions', () => ({
    ...jest.requireActual('actions/post_actions'),
    handleNewPost: jest.fn(() => ({type: 'HANDLE_NEW_POST'})),
}));

jest.mock('actions/views/channel', () => ({
    ...jest.requireActual('actions/views/channel'),
    syncPostsInChannel: jest.fn(),
}));

const mockState = {
    entities: {
        users: {
            currentUserId: 'currentUserId',
            profiles: {
                user: {
                    id: 'user',
                },
            },
            statuses: {
                user: 'away',
            },
        },
        general: {
            config: {},
        },
        channels: {
            currentChannelId: 'otherChannel',
            channels: {},
        },
        preferences: {
            myPreferences: {},
        },
        teams: {
            currentTeamId: 'currentTeamId',
        },
        posts: {
            posts: {
                post1: {id: 'post1', channel_id: 'otherChannel', create_at: '12341'},
                post2: {id: 'post2', channel_id: 'otherChannel', create_at: '12342'},
                post3: {id: 'post3', channel_id: 'channel2', create_at: '12343'},
                post4: {id: 'post4', channel_id: 'channel2', create_at: '12344'},
                post5: {id: 'post5', channel_id: 'otherChannel', create_at: '12345'},
            },
            postsInChannel: {
                otherChannel: [{
                    order: ['post5', 'post2', 'post1'],
                    recent: true,
                }],
            },
        },
    },
    views: {
        rhs: {
            selectedChannelId: 'otherChannel',
        },
    },
    websocket: {},
};

jest.mock('stores/redux_store', () => {
    return {
        dispatch: jest.fn(),
        getState: () => mockState,
    };
});

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => {
        return {type: ''};
    }),
}));

describe('handlePostEditEvent', () => {
    test('post edited', async () => {
        const post = '{"id":"test","create_at":123,"update_at":123,"user_id":"user","channel_id":"12345","root_id":"","message":"asd","pending_post_id":"2345","metadata":{}}';
        const expectedAction = {type: 'RECEIVED_POST', data: JSON.parse(post)};
        const msg = {
            data: {
                post,
            },
            broadcast: {
                channel_id: '1234657',
            },
        };

        handlePostEditEvent(msg);
        expect(store.dispatch).toHaveBeenCalledWith(expectedAction);
    });
});

describe('handleUserRemovedEvent', () => {
    test('should close RHS', async () => {
        const msg = {
            data: {
                channel_id: 'otherChannel',
            },
            broadcast: {
                user_id: 'currentUserId',
            },
        };

        handleUserRemovedEvent(msg);
        expect(closeRightHandSide).toHaveBeenCalled();
    });
});

describe('handleNewPostEvent', () => {
    const initialState = {
        entities: {
            users: {
                currentUserId: 'user1',
            },
        },
    };

    test('should receive post correctly', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user1'};
        const msg = {data: {post: JSON.stringify(post)}};

        testStore.dispatch(handleNewPostEvent(msg));
        expect(getProfilesAndStatusesForPosts).toHaveBeenCalledWith([post], expect.anything(), expect.anything());
        expect(handleNewPost).toHaveBeenCalledWith(post, msg);
    });

    test('should set other user to online', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user2'};
        const msg = {data: {post: JSON.stringify(post)}};

        testStore.dispatch(handleNewPostEvent(msg));

        expect(testStore.getActions()).toContainEqual({
            type: UserTypes.RECEIVED_STATUSES,
            data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
        });
    });

    test('should not set other user to online if post was from autoresponder', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user2', type: Constants.AUTO_RESPONDER};
        const msg = {data: {post: JSON.stringify(post)}};

        testStore.dispatch(handleNewPostEvent(msg));

        expect(testStore.getActions()).not.toContainEqual({
            type: UserTypes.RECEIVED_STATUSES,
            data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
        });
    });
});

describe('handleNewPostEvents', () => {
    test('should receive multiple posts correctly', () => {
        const testStore = configureStore();

        const posts = [
            {id: 'post1', channel_id: 'channel1'},
            {id: 'post2', channel_id: 'channel1'},
            {id: 'post3', channel_id: 'channel2'},
            {id: 'post4', channel_id: 'channel2'},
            {id: 'post5', channel_id: 'channel1'},
        ];

        const queue = posts.map((post) => {
            return {
                data: {post: JSON.stringify(post)},
            };
        });

        testStore.dispatch(handleNewPostEvents(queue));

        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: posts.map(receivedNewPost),
                type: 'BATCHING_REDUCER.BATCH',
            },
        ]);
        expect(getProfilesAndStatusesForPosts).toHaveBeenCalledWith(posts, expect.anything(), expect.anything());
    });
});

describe('reconnect', () => {
    test('should call syncPostsInChannel when socket reconnects', () => {
        reconnect(false);
        expect(syncPostsInChannel).toHaveBeenCalledWith('otherChannel', '12345');
    });
});

describe('handleUserTypingEvent', () => {
    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'user',
                statuses: {},
                users: {},
            },
        },
    };

    test('should dispatch a TYPING event', () => {
        const testStore = configureStore(initialState);

        const channelId = 'channel';
        const rootId = 'root';
        const userId = 'otheruser';
        const msg = {
            broadcast: {
                channel_id: channelId,
            },
            data: {
                parent_id: rootId,
                user_id: userId,
            },
        };

        testStore.dispatch(handleUserTypingEvent(msg));

        expect(testStore.getActions().find((action) => action.type === WebsocketEvents.TYPING)).toMatchObject({
            type: WebsocketEvents.TYPING,
            data: {
                id: channelId + rootId,
                userId,
            },
        });
    });

    test('should possibly load missing users', () => {
        const testStore = configureStore(initialState);

        const userId = 'otheruser';
        const msg = {
            broadcast: {
                channel_id: 'channel',
            },
            data: {
                parent_id: '',
                user_id: userId,
            },
        };

        testStore.dispatch(handleUserTypingEvent(msg));

        expect(getMissingProfilesByIds).toHaveBeenCalledWith([userId]);
    });

    test('should load statuses for users that are not online', () => {
        const testStore = configureStore({
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities.users,
                    statuses: {
                        ...initialState.entities.users.statuses,
                        otheruser: General.AWAY,
                    },
                },
            },
        });

        const userId = 'otheruser';
        const msg = {
            broadcast: {
                channel_id: 'channel',
            },
            data: {
                parent_id: '',
                user_id: userId,
            },
        };

        testStore.dispatch(handleUserTypingEvent(msg));

        expect(getStatusesByIds).toHaveBeenCalled();
    });

    test('should not load statuses for users that are online', () => {
        const testStore = configureStore({
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities.users,
                    statuses: {
                        ...initialState.entities.users.statuses,
                        otheruser: General.ONLINE,
                    },
                },
            },
        });

        const userId = 'otheruser';
        const msg = {
            broadcast: {
                channel_id: 'channel',
            },
            data: {
                parent_id: '',
                user_id: userId,
            },
        };

        testStore.dispatch(handleUserTypingEvent(msg));

        expect(getStatusesByIds).not.toHaveBeenCalled();
    });
});
