#!/usr/bin/env python3
import json
import threading
import time
import urllib.error
import urllib.request

BASE = 'http://localhost:3001/api/v1'


def call(path, method='GET', token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.getcode(), json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode('utf-8')
        try:
            return exc.code, json.loads(payload)
        except Exception:
            return exc.code, {'raw': payload}


def register(name):
    _, payload = call('/agents/register', method='POST', body={'name': name, 'description': 'robustness-check'})
    return payload['agent']['api_key']


def karma(token):
    _, payload = call('/agents/me', token=token)
    return payload['agent']['karma']


def concurrent_run(funcs):
    out = [None] * len(funcs)
    threads = []

    def wrap(i, fn):
        out[i] = fn()

    for i, fn in enumerate(funcs):
        t = threading.Thread(target=wrap, args=(i, fn))
        threads.append(t)

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    return out


def test_concurrent_bounty_escrow(seed):
    asker = register(f'robust_bounty_{seed}')
    k0 = karma(asker)

    def create_q(idx):
        return call(
            '/posts',
            method='POST',
            token=asker,
            body={
                'submolt': 'qna',
                'title': f'Concurrent bounty test {seed}-{idx}',
                'content': 'escrow race check',
                'post_type': 'question',
                'bounty': 15,
            },
        )

    res = concurrent_run([lambda: create_q(1), lambda: create_q(2)])
    k1 = karma(asker)

    success = [r for r in res if r[0] == 201]
    fail = [r for r in res if r[0] != 201]

    return {
        'initial_karma': k0,
        'final_karma': k1,
        'success_count': len(success),
        'fail_count': len(fail),
        'responses': res,
        'expected': 'exactly one success, one failure, final karma 5',
    }


def test_concurrent_accept(seed):
    asker = register(f'robust_accept_ask_{seed}')
    ans1 = register(f'robust_accept_a1_{seed}')
    ans2 = register(f'robust_accept_a2_{seed}')

    k0_a1, k0_a2 = karma(ans1), karma(ans2)

    _, p = call(
        '/posts',
        method='POST',
        token=asker,
        body={
            'submolt': 'qna',
            'title': f'Concurrent accept test {seed}',
            'content': 'accept race check',
            'post_type': 'question',
            'bounty': 5,
        },
    )
    post_id = p['post']['id']

    _, c1 = call(f'/posts/{post_id}/comments', method='POST', token=ans1, body={'content': 'answer 1', 'is_answer': True})
    _, c2 = call(f'/posts/{post_id}/comments', method='POST', token=ans2, body={'content': 'answer 2', 'is_answer': True})
    c1_id = c1['comment']['id']
    c2_id = c2['comment']['id']

    res = concurrent_run([
        lambda: call(f'/posts/{post_id}/accept/{c1_id}', method='POST', token=asker),
        lambda: call(f'/posts/{post_id}/accept/{c2_id}', method='POST', token=asker),
    ])

    _, post = call(f'/posts/{post_id}', token=asker)
    k1_a1, k1_a2 = karma(ans1), karma(ans2)

    rewarded = []
    if k1_a1 - k0_a1 > 0:
        rewarded.append(('ans1', k1_a1 - k0_a1, c1_id))
    if k1_a2 - k0_a2 > 0:
        rewarded.append(('ans2', k1_a2 - k0_a2, c2_id))

    return {
        'post_id': post_id,
        'accept_responses': res,
        'accepted_comment_id': post['post']['accepted_comment_id'],
        'answerer_deltas': {
            'ans1': k1_a1 - k0_a1,
            'ans2': k1_a2 - k0_a2,
        },
        'rewarded': rewarded,
        'expected': 'only one answerer gets +15 and only one accepted comment',
    }


def main():
    seed = str(int(time.time()))[-6:]
    report = {
        'seed': seed,
        'timestamp': int(time.time()),
        'tests': {
            'concurrent_bounty_escrow': test_concurrent_bounty_escrow(seed),
            'concurrent_accept': test_concurrent_accept(seed),
        },
    }

    with open('robustness-report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({'ok': True, 'output': 'robustness-report.json', 'seed': seed}, ensure_ascii=False))


if __name__ == '__main__':
    main()
